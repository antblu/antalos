# Debian RTX application node

This Ansible project provisions two independent CUDA Compose projects on
`debian-rtx` (`10.30.0.26`):

- `llama-cpp.yaml` runs llama.cpp `b10884` in router mode with an authenticated
  OpenAI-compatible API. Model files remain operator-managed under
  `/srv/llama-models`.
- `speaches.yaml` runs Speaches `0.9.0-rc.3` with CUDA 12.6.3 and persists its
  Hugging Face model cache in a named volume.

Nextcloud Live Transcription and Local Machine Translation are not part of this
Ansible project. Speaches is a standalone OpenAI-compatible speech API and is
not registered as a Nextcloud AppAPI deployment.

The VM and RTX 3060 PCI passthrough are declared in
`infrastructure/opentofu/rtxtofu`. The Compose definitions are copied to
`/opt/compose`. The playbook installs the pinned NVIDIA Container Toolkit,
requires `nvidia-smi` to identify the passed-through GPU as an RTX 3060, and
proves both containers can access it.

## Secret

Create and encrypt the vault before the first run:

```bash
cd infrastructure/ansible/rtxansible
cp vars/vault.yml.example vars/vault.yml
ansible-vault encrypt vars/vault.yml
ansible-vault edit vars/vault.yml
```

Generate the llama.cpp API key with `openssl rand -hex 32`. Keep the value
quoted, retain it in the password manager, and never commit the decrypted
vault. Existing Translate and Live Transcription values can be removed from an
older vault because the playbook no longer reads them.

## Provision

Apply `rtxtofu`, confirm VM 120 has the `rtx-3060` mapping, and wait for its
cloud-init reboot. Then run:

```bash
cd infrastructure/ansible/rtxansible
ansible-playbook site.yml --ask-vault-pass
```

The project configuration also prompts for the Debian user's sudo password at
startup so long-running image pulls cannot outlive a cached sudo credential.

llama.cpp listens on `http://10.30.0.26:8080` and exposes its compatible API
under `/v1`. Speaches listens on `http://10.30.0.26:8000`; its health endpoint
is `/health` and its OpenAI-compatible speech endpoints are under `/v1`.
