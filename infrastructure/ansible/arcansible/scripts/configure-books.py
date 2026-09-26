"""Configure book paths and qBittorrent without exposing credentials.

Run with LazyLibrarian stopped. Existing unrelated INI settings are preserved.
"""

import argparse
import configparser
import http.cookiejar
import json
import os
from pathlib import Path
import urllib.parse
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument("--config-root", required=True)
parser.add_argument("--libraries-only", action="store_true")
args = parser.parse_args()
root = Path(args.config_root)
credentials = {} if args.libraries_only else json.loads((root / "qbittorrent.json").read_text())
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
base = credentials.get("url", "").rstrip("/") + "/api/v2/"

def api(endpoint, data=None):
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    request = urllib.request.Request(base + endpoint, data=body)
    request.add_header("Referer", credentials["url"] + "/")
    with opener.open(request, timeout=20) as response:
        return response.read().decode()

if not args.libraries_only:
    # New qBittorrent releases return 204 with an empty body; older ones use Ok.
    # The authenticated categories request below verifies either response.
    if api("auth/login", {"username": credentials["username"], "password": credentials["password"]}).strip() not in ("Ok.", ""):
        raise SystemExit("qBittorrent authentication failed")
    categories = json.loads(api("torrents/categories"))
    for name in ("books", "audiobooks"):
        path = f"/media/downloads/{name}"
        existing = categories.get(name)
        if existing and existing.get("savePath") != path:
            raise SystemExit(f"Existing category {name} has a different path; refusing to change active downloads")
        if existing is None:
            api("torrents/createCategory", {"category": name, "savePath": path})
    api("auth/logout", {})

config = configparser.ConfigParser(interpolation=None, strict=False)
path = root / "config.ini"
config.read(path)
settings = {
    "General": {
        "ebook_dir": "/media/books/ebooks",
        "audio_dir": "/media/books/audiobooks",
        "download_dir": "/media/downloads/books,/media/downloads/audiobooks",
        "ebook_tab": "1", "audio_tab": "1", "destination_copy": "1",
    },
    "PostProcess": {
        "ebook_dest_folder": "$Author/$Title",
        "audiobook_dest_folder": "$Author/$Title",
    },
}
if not args.libraries_only:
    url = urllib.parse.urlsplit(credentials["url"])
    settings["TORRENT"] = {"tor_downloader_qbittorrent": "1", "keep_seeding": "1"}
    settings["QBITTORRENT"] = {
        "qbittorrent_host": f"{url.scheme}://{url.hostname}",
        "qbittorrent_port": str(url.port or (443 if url.scheme == "https" else 80)),
        "qbittorrent_user": credentials["username"],
        "qbittorrent_pass": credentials["password"],
        "qbittorrent_label": "books,audiobooks",
        "qbittorrent_dir": "",
    }
for section, values in settings.items():
    section = section.upper()
    if not config.has_section(section):
        config.add_section(section)
    for key, value in values.items():
        config.set(section, key, value)
os.umask(0o077)
temporary = path.with_suffix(".ini.tmp")
with temporary.open("w") as output:
    config.write(output)
os.chmod(temporary, 0o600)
os.chown(temporary, root.stat().st_uid, root.stat().st_gid)
temporary.replace(path)
print("Configured LazyLibrarian libraries" if args.libraries_only else
      "Configured LazyLibrarian libraries and authenticated qBittorrent book categories")
