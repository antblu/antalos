---
title: "Homelable · Operate"
description: "Deploy, update, back up, restore and populate Homelable on Debian Arc."
---

<nav class="guide-switcher" aria-label="Homelable guide sections"><a href="/user-guide/homelable/">Use</a><a href="/infrastructure/homelable/">Architecture</a><a aria-current="page" href="/admin-guide/homelable/">Operate</a></nav>

## Ownership and provisioning

The Compose definition, environment templates, public Proxmox CA and import/backup scripts live under `infrastructure/ansible/arcansible/homelable/`. Preserve the existing ignored `homelable/vars/vault.yml`; do not replace stable encryption/session or integration keys on an existing installation. New installations must privately populate the example and configure the matching Authentik provider and read-only Proxmox token before starting.

From the repository root, deploy only Homelable:

```bash
ANSIBLE_CONFIG=infrastructure/ansible/arcansible/ansible.cfg \
  /home/linuxbrew/.linuxbrew/bin/ansible-playbook \
  -i infrastructure/ansible/arcansible/inventory/hosts.yml \
  infrastructure/ansible/arcansible/homelable.yml
```

The full Arc `site.yml` also imports this playbook but performs unrelated host provisioning and service operations. Use the isolated playbook for Homelable maintenance. Secret files have mode `0600`; tasks handling credentials suppress their output. `docker compose config` can print secrets: use `config --quiet`, or inspect JSON in a protected process without echoing it.

To explicitly reconcile the Homelable Authentik application/provider using the
protected Arc OIDC credential, run from the repository root:

```bash
python3 infrastructure/ansible/arcansible/homelable/scripts/configure-authentik.py
```

This enables Authorization Code and refresh-token grants; Authentik's raw model
otherwise defaults to an empty grant list. It modifies only Homelable's provider.
For a new router, `homelable/scripts/configure-opnsense.php` is an idempotent
operator script using OPNsense's native model validation and configuration lock.
Back up the router, configure an `opnsense` SSH alias, copy and run that script
there, then apply `configctl filter reload` and `configctl unbound restart` during
approved network maintenance. The normal Arc playbook does not modify the router.

The project assumes Arc's Docker host gateway is `172.17.0.1`. Verify it before changing Docker addressing. Backend host networking does not require additional VM VLAN interfaces. Caddy's route is in Debian Left's owning Ansible project. OPNsense owns internal DNS (`homelable.antblu.net` → `10.30.0.27`) and the six source-specific inter-VLAN rules described in the [architecture](/infrastructure/homelable/); preserve those in the router's configuration backup.

## Status and API

```bash
ssh debian-arc 'sudo docker compose --project-directory /opt/compose/homelable ps'
ssh debian-arc 'sudo docker compose --project-directory /opt/compose/homelable logs --tail 100'
curl --fail https://homelable.antblu.net/api/v1/health
ssh debian-arc 'sudo python3 /opt/compose/homelable/api.py /proxmox/config'
```

The root-only `api.py` wrapper reads the backend service key locally and performs authenticated API operations. Its printed configuration responses omit credentials. Avoid printing entire documents/inventory to broadly visible logs. The frontend proxies `/docs` and `/openapi.json`; protected resource operations require authentication.

MCP is at `http://127.0.0.1:8002/mcp/` on Arc and requires `X-API-Key`. For a trusted client:

```bash
ssh -N -L 8002:127.0.0.1:8002 debian-arc
```

Configure its key privately from the protected `mcp.env`; never paste it into documentation or use a public MCP route. Both MCP keys are powerful credentials; possession allows the exposed MCP tools, including writes.

## Import architecture and existing documentation

Run the exporter from the repository root. It reads the public handbook, stable Kubernetes nodes/services/ingresses and Proxmox cluster resources through the existing SSH alias. It does not read Secret values or create pod objects.

```bash
python3 infrastructure/ansible/arcansible/homelable/scripts/export.py /tmp/homelable-topology.json
scp /tmp/homelable-topology.json debian-arc:/tmp/homelable-topology.json
ssh debian-arc 'sudo python3 /opt/compose/homelable/populate.py /tmp/homelable-topology.json'
```

An optional second exporter argument accepts a non-secret JSON list of OPNsense DNS records (`fqdn`, `server`, `description`) to include Debian/Caddy service names. The initial deployment imported those records. Without that export, existing diagrams/documents are retained; the importer does not delete unmatched objects. The exporter also reads the curated `homelable/physical.yaml` workbook facts. The importer reconciles the 12U rack with shared inventory identities and preserves unrelated rack objects. Retired ytdlp2strm entries retain history with monitoring disabled. Matching document titles are managed imports, so retain custom writing in separate pages. Proxmox sync is hourly; new pending guests still need review and canvas placement. Physical host IP correlation is specific to the verified cluster's management addresses.

## Backup and restore

No existing Arc application backup timer or Proxmox backup job was found during deployment. The root-only backup script makes a consistent local archive by stopping **only Homelable's backend**, archiving the volume and private configuration, and restarting the backend via an exit trap:

```bash
ssh debian-arc 'sudo /opt/compose/homelable/backup.sh'
```

Archives are `/opt/compose/homelable/backups/homelable-<UTC timestamp>.tar.gz`, mode `0600`. `project/` contains Compose, image variables, backend/MCP secrets and CA trust; `data/` contains the complete application volume, including the SQLite database, settings and uploads. Copy the archive to an approved encrypted/off-host backup destination. Local archives alone do not protect against VM/disk loss; no remote storage or automated retention was created.

To restore, stop this project's containers, extract the trusted archive into a root-only staging directory, restore `project/` files to `/opt/compose/homelable`, and restore **the contents of `data/`** to the Docker volume's mountpoint. On a replacement host, create the volume with `docker volume create antalos-homelable_data` first. Obtain its mountpoint using `docker volume inspect antalos-homelable_data --format '{{.Mountpoint}}'`. Preserve archive permissions and the original secrets; do not restore a running SQLite database. Start with:

```bash
ssh debian-arc 'sudo docker compose --project-directory /opt/compose/homelable up -d --wait'
```

Verify HTTPS, OIDC, topology, documentation, uploads, native Proxmox import and MCP after recovery. Restore Authentik's database/provider and Proxmox token permissions separately if those platforms were lost. The deployment backup test extracted an archive into an isolated directory and checked SQLite integrity and stored objects; it did not replace production data.

## Update and rollback

Back up before an upgrade. Read the upstream release notes, update `homelable_version` in `homelable/vars/main.yml`, and deploy the isolated playbook. On the guest, after the desired version has been rendered into `.env`:

```bash
ssh debian-arc 'sudo docker compose --project-directory /opt/compose/homelable pull'
ssh debian-arc 'sudo docker compose --project-directory /opt/compose/homelable up -d --wait'
```

For rollback, restore the preceding version in Ansible and redeploy. If an upgrade changed database schema, restore its matching pre-upgrade archive while the backend is stopped; a previous image alone is not a database rollback. Never use `down --volumes` for maintenance.

[Official Homelable installation guide](https://github.com/Pouzor/homelable/blob/v3.5.1/INSTALLATION.md).
