#!/usr/bin/env python3
"""Merge declared connections into guest-local Seerr state without replacing it."""

import argparse
import copy
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET


def docker(*args, **kwargs):
    return subprocess.check_output(["docker", *args], text=True, **kwargs)


def inspect(name):
    return json.loads(docker("inspect", name))[0]


def config_path(container, destination):
    mounts = [m for m in container["Mounts"] if m["Destination"] == destination]
    if len(mounts) != 1:
        raise ValueError("Expected one persistent configuration mount")
    return Path(mounts[0]["Source"])


def fetch(url, key, jellyfin=False):
    # Resolve service names from Seerr's own Compose network. The key travels
    # over stdin, never in a process argument or a URL query parameter.
    code = """
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', async () => {
  try {
    const p = JSON.parse(input);
    const response = await fetch(p.url, {
      headers: { [p.header]: p.key }, signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    process.stdout.write(JSON.stringify(await response.json()));
  } catch (_) { process.stderr.write('Backend API request failed\\n'); process.exit(1); }
});
"""
    return json.loads(docker(
        "exec", "-i", "seerr", "node", "-e", code,
        input=json.dumps({"url": url, "key": key,
                         "header": "X-Emby-Token" if jellyfin else "X-Api-Key"}),
        stderr=subprocess.DEVNULL,
    ))


def endpoint(connection):
    scheme = "https" if connection["use_ssl"] else "http"
    return f'{scheme}://{connection["hostname"]}:{connection["port"]}'


def env_value(path, name):
    for line in path.read_text().splitlines():
        key, separator, value = line.partition("=")
        if separator and key.strip() == name:
            return value.strip().strip("\"'")
    return ""


def prepare(desired, settings, env_path):
    jf = desired["jellyfin"]
    key = settings["jellyfin"].get("apiKey") or env_value(env_path, "JELLYFIN_API_KEY")
    if not key:
        raise ValueError("Set JELLYFIN_API_KEY in the protected media .env")
    info = fetch(endpoint(jf) + "/System/Info", key, jellyfin=True)
    if not info.get("Id"):
        raise ValueError("Jellyfin did not return its server identity")
    result = {"jellyfin": {"ip": jf["hostname"], "port": jf["port"],
                           "useSsl": jf["use_ssl"], "urlBase": "",
                           "externalHostname": jf["external_url"],
                           "name": info["ServerName"], "serverId": info["Id"],
                           "apiKey": key}}
    for service in ("radarr", "sonarr"):
        conn = desired[service]
        root = config_path(inspect(service), "/config")
        api_key = ET.parse(root / "config.xml").getroot().findtext("ApiKey")
        if not api_key:
            raise ValueError(f"{service} has no existing API key")
        profiles = fetch(endpoint(conn) + "/api/v3/qualityprofile", api_key)
        folders = fetch(endpoint(conn) + "/api/v3/rootfolder", api_key)
        matches = [p for p in profiles if p["name"] == conn["quality_profile"]]
        if len(matches) != 1 or not any(p["path"] == conn["root_folder"] for p in folders):
            raise ValueError(f"{service}: declared profile or root folder is unavailable")
        result[service] = {
            "hostname": conn["hostname"], "port": conn["port"],
            "useSsl": conn["use_ssl"], "baseUrl": "", "apiKey": api_key,
            "externalUrl": conn["external_url"], "activeProfileId": matches[0]["id"],
            "activeProfileName": matches[0]["name"], "activeDirectory": conn["root_folder"],
        }
    return result


def merge(settings, desired, connections):
    result = copy.deepcopy(settings)
    result["main"]["applicationUrl"] = desired["application_url"]
    result["main"]["mediaServerType"] = 2  # Seerr MediaServerType.JELLYFIN
    result["jellyfin"].update(connections["jellyfin"])
    for service in ("radarr", "sonarr"):
        entries = result.setdefault(service, [])
        candidates = [s for s in entries if not s.get("is4k", False) and
                      (s.get("hostname") == desired[service]["hostname"] or s.get("isDefault"))]
        if len(candidates) > 1:
            raise ValueError(f"{service}: ambiguous existing default connections")
        if candidates:
            target = candidates[0]
        else:
            target = {"id": max((s["id"] for s in entries), default=-1) + 1,
                      "name": service.title(), "is4k": False, "tags": [],
                      "syncEnabled": False, "preventSearch": False,
                      "tagRequests": False, "overrideRule": []}
            if service == "radarr":
                target["minimumAvailability"] = "released"
            else:
                target.update(seriesType="standard", animeSeriesType="anime",
                              enableSeasonFolders=True, monitorNewItems="all")
            entries.append(target)
        target.update(connections[service], isDefault=True)
    # Preserve libraries, public.initialized, users/DB, session keys, jobs,
    # notifications, extra servers and all other fields outside this contract.
    return result


def apply(path, value):
    original = path.stat()
    backup = path.with_name("settings.pre-ansible.json")
    shutil.copy2(path, backup)
    os.chmod(backup, 0o600)
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix=".settings-")
    try:
        with os.fdopen(fd, "w") as output:
            json.dump(value, output, indent=2)
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        os.chown(temporary, original.st_uid, original.st_gid)
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("connections", type=Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    desired = json.loads(args.connections.read_text())
    container = inspect("seerr")
    if not container["State"]["Running"]:
        raise ValueError("Start Seerr before configuring its connections")
    path = config_path(container, "/app/config") / "settings.json"
    settings = json.loads(path.read_text())
    connections = prepare(desired, settings, args.connections.parent / ".env")
    updated = merge(settings, desired, connections)
    if updated == settings:
        print("unchanged")
        return
    if not args.apply:
        print("changes required; all three backend connections validated")
        return
    docker("stop", "--time", "30", "seerr")
    try:
        # Reread after shutdown to retain any settings saved during validation.
        current = json.loads(path.read_text())
        apply(path, merge(current, desired, connections))
    finally:
        docker("start", "seerr")
    print("updated")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError, ET.ParseError, subprocess.SubprocessError):
        # Backend responses and credential-bearing settings must never reach logs.
        raise SystemExit("Seerr configuration failed; verify backend access, credentials, profiles and roots")
