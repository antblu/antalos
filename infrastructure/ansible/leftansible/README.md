# Debian left media host

`leftansible` configures Debian, Docker, the QEMU guest agent, and an NFS 4
mount of `10.30.0.5:/mnt/warm/jellyfin` at `/mnt/warm/jellyfin`. It copies two
independent Compose projects: Caddy to `/opt/compose/caddy` and the media stack
to `/opt/compose/media`. The playbook does not start either Compose project.
When Seerr already exists,
it validates and applies its declared connections, briefly restarting only Seerr
if its settings change.

The NFS export is for media files only. Application databases, configuration,
models, and scratch files use local Docker volumes on Debian Left. The export
must already exist and grant UID:GID `1008:1008` access. Ansible neither creates
the NAS export nor changes its ownership. The same `/media` path is visible to
Sonarr, Radarr, Lidarr, Bazarr, qBittorrent, SubGen, Explo, and ytdlp2STRM.
Use `/media/downloads`, `/media/movies`, `/media/tv`, and `/media/music` as
appropriate after creating those directories on the share. This common tree
keeps imports on one filesystem and lets the Arr applications use hardlinks.

The media Compose project declares Seerr, Sonarr, Radarr, Prowlarr,
qBittorrent, Recyclarr, Bazarr, SubGen (Whisper), autopulse, Maintainerr,
Jellyfin Auto Collections, Pixelfin, Streamystats, Lidarr, AudioMuse-AI
(with its PostgreSQL, Redis, and worker containers), Multi-Scrobbler, Explo,
ytdlp2STRM, and Cliparr. The ytdlp2STRM image is built locally so UID `1008`
can write its application log and configuration. An existing
`antalos-media_ytdlp2strm-config` volume from before that change needs its
files owned by `1008:1008`. The media project binds web ports to the Debian Left
LAN address. Caddy remains a separate project; its `Caddyfile` declares the
media HTTPS routes, including `seerr.antblu.net` to Left port 5055.

## Configure

Before starting Caddy, copy `/opt/compose/caddy/.env.example` to `.env` there
and replace the Cloudflare token. For the media project, copy
`/opt/compose/media/.env.example` to `/opt/compose/media/.env` and fill its
blank secrets. Keep that file private. Generate stable secrets for Cliparr,
Streamystats, and AudioMuse; changing them after first startup can invalidate
credentials or database access. Set a Jellyfin-issued API key and an
actual Jellyfin account ID for Jellyfin Auto Collections. The media filesystem UID `1008` is not a Jellyfin account ID.
Confirm the key against Jellyfin before starting the scheduled integration.
Jellyfin Auto Collections also needs a `config.yaml` in its local Docker volume.
The repository provides `media/jellyfin-auto-collections/config.yaml.example`
with an IMDb Top 250 example disabled until its external list fetch is
verified, based on the
[upstream example](https://github.com/ghomasHudson/Jellyfin-Auto-Collections/blob/master/config.yaml.example).
Copy it into the `antalos-media_jellyfin-auto-collections-config` volume before
starting the container. Credentials come from the protected media `.env`.
Complete each application's first-run UI setup using its own login requirements.
The qBittorrent and AudioMuse admin credentials created during setup can be
recorded in the protected media `.env` as `QBITTORRENT_USERNAME`,
`QBITTORRENT_PASSWORD`, `AUDIOMUSE_ADMIN_USER`, and
`AUDIOMUSE_ADMIN_PASSWORD`. These entries are for recovery and are not Compose
environment variables. Pixelfin and Streamystats can connect to Jellyfin with
its API key; Cliparr and Seerr require an interactive Jellyfin user login.
Prowlarr needs an indexer before new media can be acquired. Multi-Scrobbler
needs a destination account before it can submit listens.

Copy `autopulse/config.yaml.example` to `autopulse/config.yaml` on the guest,
then configure its Sonarr, Radarr, and Lidarr triggers and Jellyfin target using the
[upstream format](https://github.com/dan-online/autopulse/blob/main/example/config.yaml).
Keep the API keys in this protected guest file. The Ansible playbook copies the
example without overwriting the working `config.yaml`, then grants group `1008`
read access to that root-owned, mode `0640` protected file. Copy
`explo/.env.example` to `explo/.env` and fill it according to
[Explo's sample](https://github.com/LumePart/Explo/blob/main/sample.env).
The playbook also grants group `1008` read access to this protected file,
which Explo needs for its scheduler and web UI.

Bazarr's Whisper provider should point at `http://subgen:9000` from the media
Compose network. The existing Speaches instance on Debian RTX is an OpenAI
compatible API on port 8000; Bazarr's Whisper provider expects SubGen's API,
so it is not wired directly to Speaches. Use a small transcription transaction
to verify the provider before scheduling a library scan. SubGen's CPU `base`
model and one transcription at a time limit load on this VM. AudioMuse-AI is
also CPU and memory intensive; the existing 8 GiB VM allocation may need a
capacity review before starting every service at once.

For Cliparr's browser editor, serve it over HTTPS through a configured reverse
proxy or use localhost; browsers require a secure context for WebCodecs.
The Caddyfile declares proxy routes; DNS records are managed separately.

## Provision

From the repository root, enter `infrastructure/ansible/leftansible` and run
`ansible-playbook site.yml` after confirming that the NFS export is available.
The playbook performs package upgrades and mounts the share, so schedule it as
normal host maintenance. It does not start the stacks. Existing Seerr settings
may be updated with a targeted restart. Once the required secrets and application
files are in place, start the media project on the VM
with `docker compose --project-directory /opt/compose/media up -d`.

A host restart must mount NFS before media containers use the bind path. The
Compose media bind mounts forbid Docker from creating a missing host directory.
Check the mounted source before starting the stack; a bare local mountpoint is
not media storage. Back up the local Docker volumes and the protected `.env` /
application configuration files separately from the NFS media export.

## Seerr configuration and recovery

Compose owns Seerr's image, timezone, port 5055, init process, health check,
and persistent `antalos-media_seerr-config` volume mounted at `/app/config`.
The official image runs as `node` (UID:GID `1000:1000`); keep that identity for
its local configuration, independent of the NFS media identity `1008:1008`.
Seerr does not need a media bind mount or LinuxServer `PUID`/`PGID` variables.
See the upstream [Docker guide](https://docs.seerr.dev/getting-started/docker/).

`vars/main.yml` declares the Jellyfin, Radarr, and Sonarr connections under
`left_seerr_connections`, including public URLs, quality profile names, and root
folders. The playbook renders these nonsecret inputs to
`/opt/compose/media/seerr-connections.json` and runs `configure-seerr.py` when
Seerr exists. The configurator reads Arr API keys from their existing local
Docker config volumes and reuses Seerr's Jellyfin credential or, on first setup,
`JELLYFIN_API_KEY` from the protected media `.env`. It validates Jellyfin's
identity and both Arr profile/root-folder selections from Seerr's own network
before changing anything. It does not reset credentials or modify those servers.
Jellyfin validation uses `Authorization: MediaBrowser Token="…"`; Arr validation
uses `X-Api-Key`. A rejected legacy Jellyfin token header does not establish
that the credential itself is invalid.
If Jellyfin rejects Seerr's saved credential with HTTP 401 or 403, the
configurator tries the protected environment key before failing. A successful
replacement is saved only after all three backend checks pass. Failures report
the backend and HTTP status without displaying keys or backend response bodies.

Radarr's Compose environment explicitly allows its `radarr` service hostname,
public hostname, and Left LAN address through `left_radarr_allowed_hosts`.
This overrides a guest-local Allowed Hosts setting that might otherwise accept
only the public proxy hostname and reject Seerr's internal requests with HTTP
400. After rendering a changed Compose definition, recreate only Radarr with
`docker compose --project-directory /opt/compose/media up -d --no-deps radarr`
before applying Seerr connections. The copy-only phase does not recreate it.

For a fresh installation, fill the protected media environment, start Seerr,
Sonarr, and Radarr, and ensure their root folders exist. Then run the focused
playbook, which avoids host package upgrades and NFS maintenance:

```bash
cd infrastructure/ansible/leftansible
ansible-playbook seerr.yml
```

If settings differ, the configurator stops only Seerr, merges the declared
connections, saves a protected `settings.pre-ansible.json` backup beside its
settings, and restarts it. Unchanged settings require no restart. It preserves
session keys, existing users and requests, library selections, unrelated settings,
and additional servers. The declared non-4K default server is managed for each
Arr application; ambiguous existing defaults fail rather than replace servers.
Select a different quality profile in `vars/main.yml` if `Any` is unsuitable.

Complete the Jellyfin administrator login and library selection in Seerr's UI;
Ansible supplies the backend connections but does not invent a user account or
mark onboarding complete. Test a representative authorized request through
acquisition and Jellyfin discovery after applying the configuration.

The repository deliberately does not contain Seerr's generated `settings.json`,
session keys, Jellyfin login, Arr API keys, users, or request database. Preserve
the entire config volume, including the original settings and SQLite database,
using the upstream [backup procedure](https://docs.seerr.dev/using-seerr/backups/).
Stop Seerr for a consistent file-copy backup. Restore that volume and its
`1000:1000` ownership before starting the same Compose project; an empty new
volume returns to onboarding. A successful public health endpoint proves HTTP
readiness, not completion of onboarding or downloader integration.

## Stateful dependency updates

AudioMuse's existing PostgreSQL volume uses major 15 and its Redis volume uses
major 7. Keep those image lines until a separately planned migration is complete;
Renovate major updates are disabled for these two dependencies in this project.
PostgreSQL major upgrades require a supported dump/restore or `pg_upgrade`
procedure and a tested backup. Changing the image tag alone cannot migrate the
existing data directory. PostgreSQL 18 also changes the official image's default
data layout; consult its [image documentation](https://hub.docker.com/_/postgres)
before changing the volume target.

## Workload image versions

Image and Docker build-base pins live in this project's `variables.yaml` and carry Renovate annotations. The playbook renders both `caddy/compose.yaml` and `media/compose.yaml` with these values after copying their projects. The repository copies are Jinja templates; run Docker Compose against the rendered guest files. Rendering does not start or restart either stack. Protected `.env` files continue supplying credentials and runtime settings. The optional ytdlp2strm build receives `YTDLP2STRM_BASE_IMAGE` through Compose when enabled.
