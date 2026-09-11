# Debian RTX application node

This Ansible project provisions the CUDA workload on `debian-rtx`
(`10.30.0.26`). The VM and NVIDIA RTX 3060 PCI passthrough are declared in
`infrastructure/opentofu/rtxtofu`; its cloud-init installs Docker, the standard
Debian kernel and matching headers, and the Debian NVIDIA driver. Cloud-init
then reboots into that kernel before Ansible runs.

This project is copied to `/opt/compose` on the VM. It runs these GPU-enabled services:

- llama.cpp `b10884` with CUDA, all model layers requested on GPU, and an
  authenticated OpenAI-compatible API in router mode. Model files are
  operator-managed under `/srv/llama-models`; the playbook does not download or
  validate a model.
- Nextcloud Local Machine Translation `2.3.3` with CTranslate2 CUDA.
- Nextcloud Live Transcription `2.1.3` using its CUDA build and one concurrent
  worker to bound RTX memory use.
- Nextcloud HaRP `0.4.5`, which exposes the two manually managed ExApps through
  the existing `/exapps/` ingress path without mounting the Docker socket.

The playbook installs and configures the pinned NVIDIA Container Toolkit, then
requires `nvidia-smi` to identify the passed-through card as an RTX 3060. It
also requires both Nextcloud inference containers to see that GPU, waits for
their ExApp heartbeats, and registers and enables the ExApps in Nextcloud. The
playbook does not check llama.cpp readiness or execute a model request.

## Secrets

Create and encrypt the vault before the first run:

```bash
cd infrastructure/ansible/rtxansible
cp vars/vault.yml.example vars/vault.yml
ansible-vault encrypt vars/vault.yml
ansible-vault edit vars/vault.yml
```

Generate four different 64-character hexadecimal values with
`openssl rand -hex 32`: the llama.cpp API key, HaRP shared key, and the two
ExApp application secrets. The playbook reads the Talk internal secret directly
from the `internal-secret` key in the `nextcloud-talk` Kubernetes Secret so the
Live Transcription client always matches signaling's `clients.internalsecret`.
Keep the vault values quoted, retain the originals in the password manager, and
never commit the decrypted vault.

For an existing encrypted vault, use only:

```bash
ansible-vault edit vars/vault.yml
```

## Provision

The `rtxtofu` VM enables the existing `rtx-3060` Proxmox PCI resource mapping by
default. Apply `rtxtofu`, confirm VM 120 has a `hostpci0` entry and wait for the
cloud-init reboot to finish. Then run:

```bash
cd infrastructure/ansible/rtxansible
ansible-playbook site.yml --ask-vault-pass
```

The initial run allows the Nextcloud containers to download their model data,
so it can take substantially longer than later runs. llama.cpp is deployed and
started in router mode even when `/srv/llama-models` is empty. Place any desired
GGUF files in that directory; they are loaded on demand rather than installed
by Ansible. The service listens on `http://10.30.0.26:8080`, requires the vault
API key as an OpenAI bearer token, and exposes its OpenAI-compatible API under
`http://10.30.0.26:8080/v1`.

The playbook replaces any prior `translate2` and `live_transcription` AppAPI
registrations with the `rtx_compose` CUDA daemon. It does not change the Talk
shared signaling secret; it consumes the existing internal secret required by
Live Transcription. Test a real translation and a complete Talk transcription
from Nextcloud after provisioning, since language quality and end-user audio
behavior cannot be established by an infrastructure heartbeat alone.
