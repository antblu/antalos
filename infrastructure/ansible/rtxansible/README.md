# Debian RTX application node

This Ansible project provisions only the CUDA workloads that remain on
`debian-rtx` (`10.30.0.26`):

- llama.cpp `b10884`, with all model layers requested on the RTX 3060 and an
  authenticated OpenAI-compatible API in router mode.
- Nextcloud Local Machine Translation `2.3.3` with CTranslate2 CUDA.

The VM and RTX 3060 PCI passthrough are declared in
`infrastructure/opentofu/rtxtofu`. Compose is copied to `/opt/compose`, and
llama.cpp model files remain operator-managed under `/srv/llama-models`.
Nextcloud Live Transcription is intentionally absent; it is managed by
`infrastructure/ansible/leftansible` on `debian-left`.

The playbook installs the pinned NVIDIA Container Toolkit, requires
`nvidia-smi` to identify the passed-through GPU as an RTX 3060, proves both
containers can access it, and registers Translate as a direct AppAPI manual
deployment. Running Compose with `--remove-orphans` removes the former HaRP and
Live Transcription containers from this host.

## Secrets

Create and encrypt the vault before the first run:

```bash
cd infrastructure/ansible/rtxansible
cp vars/vault.yml.example vars/vault.yml
ansible-vault encrypt vars/vault.yml
ansible-vault edit vars/vault.yml
```

Generate two different 64-character hexadecimal values with
`openssl rand -hex 32`: the llama.cpp API key and the Translate application
secret. Keep the vault values quoted, retain the originals in the password
manager, and never commit the decrypted vault.

For an existing encrypted vault, no secret rotation is required for this move.
The old HaRP and Live Transcription values may be removed with:

```bash
ansible-vault edit vars/vault.yml
```

## Provision

Apply `rtxtofu`, confirm VM 120 has the `rtx-3060` mapping, and wait for its
cloud-init reboot. Run `leftansible` first when migrating the existing
Live Transcription registration, then run:

```bash
cd infrastructure/ansible/rtxansible
ansible-playbook site.yml --ask-vault-pass
```

The playbook replaces only the `translate2` AppAPI registration and preserves
the `live_transcription` registration owned by `left_compose`. llama.cpp listens
on `http://10.30.0.26:8080`, requires the vault API key as an OpenAI bearer
token, and exposes its compatible API under `http://10.30.0.26:8080/v1`.

Test a real translation after provisioning; container health and GPU identity
do not establish end-user translation quality.
