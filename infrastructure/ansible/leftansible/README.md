# Debian left host

The VM is declared in `infrastructure/opentofu/lefttofu` with 4 CPU cores and
8 GiB of RAM.

This playbook configures the Debian hostname, timezone, APT repositories,
system upgrades, Docker host packages, and the QEMU guest agent. It does not
copy Compose files, create containers, or change Nextcloud registration.

After applying `lefttofu` and waiting for cloud-init to finish, run:

```bash
cd infrastructure/ansible/leftansible
ansible-playbook site.yml
```
