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

Docling publishes CPU, CUDA, and AMD deployment paths, but no Intel container.
`compose/Dockerfile.docling-xpu` therefore layers pinned Docling Serve and
its OCR/model dependencies onto Intel's pinned XPU runtime image. This supplies
both XPU-enabled PyTorch and the Intel Level Zero compute runtime. The playbook
proves that the resulting container can execute a tensor operation on the Arc
GPU. For Immich, it verifies the ONNX Runtime OpenVINO execution provider and
requires that the provider reports an Intel GPU device.

The playbook enables `antalos-arc-compose.path` for future boots. It waits for
`/dev/dri/renderD128` before recreating Immich Machine Learning, Nextcloud
Talk Recording, Trailarr, and Tdarr, preventing Docker from capturing an incomplete device set while
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
