# Debian Arc application node

This Ansible project provisions the Docker workload on `debian-arc`
(`10.30.0.28`). The VM and Intel Arc A310 PCI passthrough are declared in
`infrastructure/opentofu/arctofu`; its cloud-init installs Docker and the host
Intel firmware/media packages before Ansible runs.

The Debian `genericcloud` image initially boots a reduced `cloud-amd64` kernel
that does not contain the `i915` module. Both cloud-init and Ansible install the
full `linux-image-amd64` kernel, stop tracking the cloud-kernel metapackage, and
reboot once before requiring `/dev/dri/renderD128`.

The Compose source of truth is `arc-compose/compose.yaml`. It runs exactly these
GPU-enabled services:

- Immich Machine Learning `v3.1.0` with the OpenVINO image and Arc device `0`.
- Nextcloud Talk Recording, pinned by its amd64 digest, with automatic Intel
  VA-API `h264_vaapi` encoding.
- Jellyfin `12.0.20260908-012347` with QSV enabled on
  `/dev/dri/renderD128`.
- Docling Serve `1.30.0` on Intel's dated PyTorch XPU `2.13.0` image for Intel
  GPU inference.

Docling publishes CPU, CUDA, and AMD deployment paths, but no Intel container.
`arc-compose/Dockerfile.docling-xpu` therefore layers pinned Docling Serve and
its OCR/model dependencies onto Intel's pinned XPU runtime image. This supplies
both XPU-enabled PyTorch and the Intel Level Zero compute runtime. The playbook
proves that the resulting container can execute a tensor operation on the Arc
GPU.

## Secrets

Create and encrypt the vault before the first run:

```bash
cd infrastructure/ansible/arcansible
cp vars/vault.yml.example vars/vault.yml
ansible-vault encrypt vars/vault.yml
ansible-vault edit vars/vault.yml
```

Generate new 64-character hexadecimal values for the recording secret and
Docling API key with `openssl rand -hex 32`. The Talk internal secret is not a
new independent value: it must match `clients.internalsecret` on the standalone
signaling server. The recording secret is shared with Nextcloud's Talk recording
configuration. Keep all three quoted in the vault and store their originals in
the password manager; never commit the decrypted vault.

For an existing encrypted vault, use only:

```bash
ansible-vault edit vars/vault.yml
```

The file must contain these three keys:

```yaml
vault_nextcloud_talk_recording_secret: "<64 hexadecimal characters>"
vault_nextcloud_talk_internal_secret: "<existing 64-character signaling secret>"
vault_docling_api_key: "<different 64 hexadecimal characters>"
```

## Provision

After OpenTofu has created the VM and attached the Arc A310, run:

```bash
cd infrastructure/ansible/arcansible
ansible-playbook site.yml --ask-vault-pass
```

The playbook refuses to deploy without the `i915` render device, copies the
Compose project to `/opt/arc-compose`, starts all four containers, waits for the
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
QSV, Intel low-power encoding, and the Arc render device. Its media directory is
`/srv/media`; mount the intended storage there before adding libraries.

Cloud-init runs only on first boot. For an existing VM, recreate it to apply a
changed cloud-init dependency set, or install the same packages manually before
running the playbook. The playbook also repairs the active Debian repository
configuration, including `contrib`, `non-free`, and `non-free-firmware`, so an
existing VM does not need to be recreated solely for missing package sources.
