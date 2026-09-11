# Debian left transcription node

This Ansible project provisions only Nextcloud Live Transcription `2.1.3` on
`debian-left` (`10.30.0.27`). The VM is declared in
`infrastructure/opentofu/lefttofu` with 4 CPU cores and 16 GiB of RAM, matching
Nextcloud's CPU sizing guidance for one or two concurrent calls.

The CPU image is pinned by digest and Compose is copied to `/opt/compose`.
The service is published only on the internal VM address and registered as the
`left_compose` CPU AppAPI manual deployment. llama.cpp, Nextcloud Translate,
HaRP, and NVIDIA runtime configuration are intentionally absent. Running
Compose with `--remove-orphans` removes any services inherited from the initial
RTX project copy.

## Secrets

Create and encrypt the vault before the first run:

```bash
cd infrastructure/ansible/leftansible
cp vars/vault.yml.example vars/vault.yml
ansible-vault encrypt vars/vault.yml
ansible-vault edit vars/vault.yml
```

Generate one 64-character hexadecimal application secret with
`openssl rand -hex 32`. To preserve the existing AppAPI identity during the
migration, reuse the current `vault_nextcloud_live_transcription_app_secret`
from the RTX vault. The playbook reads the Talk internal secret directly from
the `nextcloud-talk` Kubernetes Secret; do not copy that secret into this vault.

Keep the vault value quoted, retain it in the password manager, and never
commit the decrypted vault.

## Provision

Apply `lefttofu` and wait for VM 122 to complete its cloud-init reboot. Migrate
Live Transcription before replacing the old RTX daemon:

```bash
cd infrastructure/ansible/leftansible
ansible-playbook site.yml --ask-vault-pass
```

Then run `rtxansible` to remove the former RTX transcription and HaRP
containers while retaining Translate and llama.cpp. The left playbook replaces
only the `live_transcription` AppAPI registration and does not alter Translate.

Test a complete Talk transcription after provisioning; container health cannot
establish end-user audio capture or language quality.
