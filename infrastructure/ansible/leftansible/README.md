# Debian left  node

The VM is declared in
`infrastructure/opentofu/lefttofu` with 4 CPU cores and 8GiB of RAM

The CPU image is pinned by digest and Compose is copied to `/opt/compose`.

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