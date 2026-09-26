"""Read the existing Sonarr download-client identity without changing it.

Run on Debian Left through its SSH alias; capture stdout with Ansible no_log.
"""

import json
import sqlite3
import subprocess
from pathlib import Path

mounts = json.loads(subprocess.check_output(
    ["docker", "inspect", "sonarr", "--format", "{{json .Mounts}}"], text=True
))
config = next(Path(m["Source"]) for m in mounts if m["Destination"] == "/config")
with sqlite3.connect(f"file:{config / 'sonarr.db'}?mode=ro", uri=True) as db:
    rows = db.execute("SELECT Settings FROM DownloadClients WHERE Implementation = 'QBittorrent'")
    for (settings,) in rows:
        client = json.loads(settings)
        if client.get("username") and client.get("password"):
            print(json.dumps({"username": client["username"], "password": client["password"]}))
            break
    else:
        raise SystemExit("Sonarr has no configured qBittorrent credentials")
