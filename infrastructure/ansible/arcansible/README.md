# Debian Arc application node

This Ansible project provisions the Docker workload on `debian-arc`
(`10.30.0.28`). The VM and Intel Arc A310 PCI passthrough are declared in
`infrastructure/opentofu/arctofu`; its cloud-init installs Docker and the host
Intel firmware/media packages before Ansible runs.

The Debian `genericcloud` image initially boots a reduced `cloud-amd64` kernel
that does not contain the `i915` module. Both cloud-init and Ansible install the
full `linux-image-amd64` kernel, stop tracking the cloud-kernel metapackage, and
set that kernel as GRUB's explicit top-level entry before rebooting and requiring
`/dev/dri/renderD128`. This is necessary because the cloud and standard kernel
can have the same upstream version while GRUB's automatic ordering still selects
the hardware-trimmed cloud variant.

The Compose source of truth is `compose/compose.yaml`. Its project name is
`antalos-debian-arc`, matching the existing containers; keep that identity
when changing services so Compose adopts them rather than trying to create
new containers with conflicting names. It runs these services:

- Immich Machine Learning `v3.1.0` with the OpenVINO image and Arc device `0`.
- Nextcloud Talk Recording, pinned by its amd64 digest, with automatic Intel
  VA-API `h264_vaapi` encoding.
- Jellyfin `12.0.20260908-012347` with QSV enabled on
  `/dev/dri/renderD128`.
- Docling Serve `1.30.0` on Intel's dated PyTorch XPU `2.13.0` image for Intel
  GPU inference.
- Trailarr for trailer management beside the media library.
- Tdarr with an internal node and the Arc render device for media encoding.
- Storyteller `latest-sycl` for ebooks, audiobooks, and synced narration on
  the Arc GPU, with its application running as UID:GID `1008:1008`.
- LazyLibrarian for author discovery and separate ebook/audiobook downloads
  through Debian Left's existing qBittorrent endpoint.

Docling publishes CPU, CUDA, and AMD deployment paths, but no Intel container.
`compose/Dockerfile.docling-xpu` therefore layers pinned Docling Serve and
its OCR/model dependencies onto Intel's pinned XPU runtime image. This supplies
both XPU-enabled PyTorch and the Intel Level Zero compute runtime. The playbook
proves that the resulting container can execute a tensor operation on the Arc
GPU. For Immich, it verifies the ONNX Runtime OpenVINO execution provider and
requires that the provider reports an Intel GPU device.

The playbook enables `antalos-arc-compose.path` for future boots. It waits for
`/dev/dri/renderD128` before recreating Immich Machine Learning, Nextcloud
Talk Recording, Trailarr, Tdarr, and Storyteller, preventing Docker from capturing an incomplete device set while
the Arc driver is still initializing.

## Secrets

Create and encrypt the vault before the first run:

```bash
cd infrastructure/ansible/arcansible
cp vars/vault.yml.example vars/vault.yml
ansible-vault encrypt vars/vault.yml
ansible-vault edit vars/vault.yml
```

Generate new 64-character hexadecimal values for the recording secret and
Docling API key with `openssl rand -hex 32`. The playbook reads the Talk internal
secret directly from the live `nextcloud-talk` Kubernetes Secret so it cannot
drift from `clients.internalsecret` on the standalone signaling server. The
recording secret is shared with Nextcloud's Talk recording configuration. Keep
both generated values quoted in the vault and store their originals in the
password manager; never commit the decrypted vault.

For an existing encrypted vault, use only:

```bash
ansible-vault edit vars/vault.yml
```

The file must contain these two keys:

```yaml
vault_nextcloud_talk_recording_secret: "<64 hexadecimal characters>"
vault_docling_api_key: "<different 64 hexadecimal characters>"
```

## Provision

After OpenTofu has created the VM and attached the Arc A310, run:

```bash
cd infrastructure/ansible/arcansible
ansible-playbook site.yml --ask-vault-pass
```

The playbook refuses to deploy without the `i915` render device, copies the
Compose project to `/opt/compose`, starts the declared containers, waits for the
HTTP services and container health checks, and then runs GPU smoke tests for
OpenVINO, VA-API, and PyTorch XPU plus a real Docling conversion request. It
also proves that the Nextcloud pod can reach the recorder before writing Talk's
`recording_servers` setting through the repository kubeconfig.

The Immich server is managed elsewhere. Add `http://10.30.0.28:3003` under
**Administration settings → Machine Learning → URLs** and keep the local URL as
a fallback if desired. Docling is available at `http://10.30.0.28:5001`; clients
must send the configured value in the `X-Api-Key` header. Jellyfin is available
at `http://10.30.0.28:8096`.

Jellyfin's `encoding.xml` is Ansible-managed so rerunning the playbook retains
QSV, Intel low-power encoding, and the Arc render device. Jellyfin, Trailarr,
and Tdarr share the NFS media export `10.30.0.5:/mnt/warm/jellyfin`, mounted
at `/mnt/warm/jellyfin` on the VM and `/media` in the containers. The NAS must
expose the directory to UID:GID `1008:1008`. Ansible does not change NFS
ownership. Jellyfin configuration and cache, Trailarr state, and Tdarr state
and transcode scratch space remain on the VM under `/opt/compose/data`. Jellyfin
keeps its existing `1100:1100` identity for local configuration and cache,
with supplemental media group `1008` for the NFS library. Trailarr and Tdarr
use `1008:1008` for media writes. The playbook restores ownership of Jellyfin's
local config and cache if an interrupted UID migration changed them; back up
that state before replaying the playbook.
Review existing Jellyfin library paths when switching from `/srv/media`.

Storyteller is available at `http://10.30.0.28:8001`; create the initial admin
account there. It uses `registry.gitlab.com/storyteller-platform/storyteller:latest-sycl`
and the host render/video groups. Following Storyteller's supported startup flow,
`PUID` and `PGID` select `1008:1008` after the entrypoint prepares the container.
Do not add Compose `user:` because that bypasses its permission setup.

`STORYTELLER_ASSETS_DIR=/media/storyteller` keeps uploaded ebooks, audiobooks,
aligned books, and covers in `/mnt/warm/jellyfin/storyteller` on the same NFS
export as Jellyfin. The database, models, and temporary processing files remain
local under `/opt/compose/data/storyteller`, mounted as `/data`. The playbook
creates the NFS assets directory as the media user without changing existing
library ownership. Add `/media/storyteller` to Jellyfin if it should read this
library, and select existing book folders under `/media` in Storyteller when
configuring auto-import.

The playbook generates `/opt/compose/data/storyteller/secret_key` once and
preserves it on later runs, owned by `1008:1008` with mode `0600`. It is read
through `STORYTELLER_SECRET_KEY_FILE`; keep this guest-local credential out of
Git and back it up with the local database and NFS assets. Restoring the VM
requires all three. The playbook waits for Storyteller HTTP, but a representative
book alignment is still needed to prove transcription through the selected GPU.
See the upstream [self-hosting](https://storyteller-platform.dev/docs/installation/self-hosting/)
and [GPU setup](https://storyteller-platform.dev/docs/installation/gpu-configuration/)
guides.

## LazyLibrarian and Storyteller book integration

LazyLibrarian uses `lscr.io/linuxserver/lazylibrarian:latest` and listens at
`http://10.30.0.28:5299/home`. Its application runs as `1008:1008` through
`PUID`/`PGID`; configuration and SQLite state remain local in
`/opt/compose/data/lazylibrarian`. It shares `/media` with qBittorrent on Debian
Left and Storyteller on Arc, backed by the existing Jellyfin NFS export.

| Purpose | Container path | qBittorrent category |
| --- | --- | --- |
| Ebook downloads | `/media/downloads/books` | `books` |
| Audiobook downloads | `/media/downloads/audiobooks` | `audiobooks` |
| Completed ebooks | `/media/books/ebooks` | — |
| Completed audiobooks | `/media/books/audiobooks` | — |

`scripts/configure-books.py` authenticates to the endpoint declared by
`books_qbittorrent_url`, creates missing categories, and writes only the owning
library and downloader settings into LazyLibrarian's INI. Existing unrelated
settings are preserved; the playbook stops LazyLibrarian before writing and
starts it afterward. Both formats use `$Author/$Title` folders. The ordered
qBittorrent label list `books,audiobooks` selects the matching category for each
format. Leave the downloader's save-path override empty so category paths apply.
Keep-seeding and destination-copy are enabled to preserve downloaded originals.
The script refuses to overwrite an existing category with a different save path.

The protected guest file `data/lazylibrarian/qbittorrent.json` stores the downloader
connection, owned by `1008:1008` with mode `0600`. Ansible preserves this file's
identity on subsequent runs. On first installation it reads Sonarr's existing
credentials over the `debian-left` SSH alias, with `no_log` enabled. If those are
stale or a new identity is needed, set `vault_books_qbittorrent_username` and
`vault_books_qbittorrent_password` in the existing encrypted `vars/vault.yml`.
These optional values override the saved identity. Neither credentials nor
generated INI files belong in Git. The playbook requires a working downloader
login to complete the integration; it does not reset qBittorrent credentials
or change its VPN configuration.

`compose/storyteller.json` declares reference imports from both completed-book
libraries. Compose mounts this file read-only and sets `STORYTELLER_CONFIG`.
Storyteller's startup reads it and adds both watch rules while retaining unrelated
database settings. The two source libraries stay in place; imports from separate
folders may require **merge books** before alignment. Import rules from the file
are managed in Ansible rather than edited in Storyteller's UI. The existing
public auth URL is controlled by `storyteller_auth_url`.

Configure your authorized search providers in LazyLibrarian's Providers settings,
then add an author and mark an ebook or audiobook Wanted. Downloader connectivity
and container readiness do not prove a provider search, download, post-processing,
or Storyteller alignment. Use a representative book to confirm that complete
workflow. See the upstream [downloader](https://lazylibrarian.gitlab.io/config_downloaders/),
[processing](https://lazylibrarian.gitlab.io/config_processing/), and
[Storyteller import](https://storyteller-platform.dev/blog/20260525_scanner/) guides.

If an earlier run stopped while writing the protected Compose environment after
changing Jellyfin's local file ownership, resume from the Jellyfin account task:

```bash
cd infrastructure/ansible/arcansible
ansible-playbook site.yml --ask-vault-pass --start-at-task "Create the Jellyfin group"
```

That resumes the local ownership repair, reloads both GPU group IDs, rereads
the Talk internal secret, writes `.env`, and continues the Compose rollout.
Do not resume directly at the template task; `--start-at-task` skips the facts
and secret read required by that template.

Trailarr listens on port 7889 and Tdarr on ports 8265 and 8266. Both
containers receive `/dev/dri`, the host render and video groups, and the Arc
render-device boot recovery. The playbook runs an H.264 VA-API encode inside
each container after startup, and checks Trailarr's VA-API device discovery.
These checks encode a synthetic test pattern into the null output, leaving the
media share untouched.

Configure Trailarr's Radarr and Sonarr connections using `/media` paths that
match the Debian Left stack. In Trailarr, enable Intel GPU acceleration under
**Settings → General → Advanced Settings** and check **Settings → Health** for
Intel GPU detection. Hardware acceleration applies when the trailer profile
requires a supported video conversion; a copied video stream does not encode.

Tdarr's internal node starts with one GPU transcode worker and no CPU
transcode workers. Configure a library under `/media` and choose a VA-API or
Intel QSV flow or plugin in Tdarr. Worker selection alone does not convert a
software FFmpeg command into hardware encoding. Test one media file before
enabling bulk conversion. The playbook's VA-API smoke test proves the device
and encoder are usable, while a completed Tdarr job proves the selected flow
uses them.

Cloud-init runs only on first boot. For an existing VM, recreate it to apply a
changed cloud-init dependency set, or install the same packages manually before
running the playbook. The playbook also repairs the active Debian repository
configuration, including `contrib`, `non-free`, and `non-free-firmware`, so an
existing VM does not need to be recreated solely for missing package sources.

## Homelable infrastructure mapper

Homelable is an independent Compose project at `/opt/compose/homelable`. Run
`homelable.yml` for isolated maintenance; the full `site.yml` imports it. Sources,
public Proxmox CA and scripts are under `homelable/`; private credentials are in
ignored `homelable/vars/vault.yml` (mode `0600`). Preserve these keys across runs.
The backend uses host networking but binds only Docker's host-side address. MCP
uses loopback port 8002 because Storyteller owns LAN port 8001.

See `docs/admin-guide/homelable.md` for OIDC/Proxmox prerequisites, DNS/firewall
ownership, handbook import, backup/restore, updates and rollback.

Homelable physical rack and EX3300 assignments are curated from the owner’s workbook in `homelable/physical.yaml`. The controller exporter requires PyYAML and includes these facts automatically; the API importer adds the **12U Rack** design and retains unrelated rack objects. See `docs/infrastructure/homelable-physical.md` for positions, port assignments and source discrepancies.
