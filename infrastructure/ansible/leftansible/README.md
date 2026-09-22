# Debian left host

The VM is declared in `infrastructure/opentofu/lefttofu` with 4 CPU cores and
8 GiB of RAM.

This playbook configures the Debian hostname, timezone, APT repositories,
system upgrades, Docker Engine with the Compose and Buildx plugins, and the
QEMU guest agent. It also deploys the Caddy Compose project to
`/opt/compose/caddy`.

Before starting Caddy, copy `/opt/compose/caddy/.env.example` to
`/opt/compose/caddy/.env` and replace the placeholder Cloudflare API token.

After applying `lefttofu` and waiting for cloud-init to finish, run:

```bash
cd infrastructure/ansible/leftansible
ansible-playbook site.yml
```

The playbook deploys the project files but does not start the Caddy container.
