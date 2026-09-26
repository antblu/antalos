#!/bin/sh
set -eu
umask 077
root=/opt/compose/homelable
mkdir -p "$root/backups"
exec 9>"$root/backups/.lock"
flock -n 9
stamp=$(date -u +%Y%m%dT%H%M%SZ)
archive="$root/backups/homelable-$stamp.tar.gz"
docker compose --project-directory "$root" stop backend
trap 'docker compose --project-directory "$root" up -d --wait --wait-timeout 120 backend >/dev/null' EXIT HUP INT TERM
volume=$(docker volume inspect antalos-homelable_data --format '{{.Mountpoint}}')
python3 - "$archive" "$root" "$volume" <<'PYBACKUP'
import pathlib,sys,tarfile
archive,root,volume=sys.argv[1:]
with tarfile.open(archive,'w:gz') as t:
    for name in ['compose.yaml','.env','backend.env','mcp.env','ca-bundle.crt']:
        t.add(str(pathlib.Path(root)/name),arcname='project/'+name)
    t.add(volume,arcname='data')
PYBACKUP
chmod 600 "$archive"
printf '%s\n' "$archive"
