# Debian left media host

`leftansible` configures Debian, Docker, the QEMU guest agent, and an NFS 4
mount of `10.30.0.5:/mnt/warm/jellyfin` at `/mnt/warm/jellyfin`. It copies two
independent Compose projects: Caddy to `/opt/compose/caddy` and the media stack
to `/opt/compose/media`. The playbook does not start either Compose project.

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
LAN address. Caddy remains a separate project and has no routes added here.

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
No public routes or DNS records are declared here.

## Provision

From the repository root, enter `infrastructure/ansible/leftansible` and run
`ansible-playbook site.yml` after confirming that the NFS export is available.
The playbook performs package upgrades and mounts the share, so schedule it as
normal host maintenance. It does not start the services. Once the required
secrets and application files are in place, start the media project on the VM
with `docker compose --project-directory /opt/compose/media up -d`.

A host restart must mount NFS before media containers use the bind path. The
Compose media bind mounts forbid Docker from creating a missing host directory.
Check the mounted source before starting the stack; a bare local mountpoint is
not media storage. Back up the local Docker volumes and the protected `.env` /
application configuration files separately from the NFS media export.
