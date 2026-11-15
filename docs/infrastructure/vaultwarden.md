---
title: "Vaultwarden · Architecture"
description: "The Vaultwarden server, replicated PostgreSQL, and persistent vault files."
---

<nav class="guide-switcher" aria-label="Vaultwarden guide sections"><a href="/user-guide/vaultwarden/">Use</a><a aria-current="page" href="/infrastructure/vaultwarden/">Architecture</a><a href="/admin-guide/vaultwarden/">Operate</a></nav>

One Vaultwarden application replica uses the chart’s Recreate strategy. PostgreSQL runs as a two-instance CNPG cluster, while `/data` is a retained shared NFS volume. Traefik provides HTTPS using `vaultwarden-tls`. Public signup is disabled and the chart references a sealed administrator token.

## Components

<figure class="architecture-diagram" aria-label="Vaultwarden · component flow">
<div class="diagram-heading">Vaultwarden · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Vault clients</span><ul><li>Bitwarden-compatible clients</li><li>Application authentication / HTTPS</li></ul></li><li class="diagram-stage"><span class="diagram-label">Vault server</span><ul><li>1 application replica</li><li>Recreate updates</li></ul></li><li class="diagram-stage"><span class="diagram-label">Durable state</span><ul><li>PostgreSQL · 2 instances</li><li>NFS /data + sealed credentials</li></ul></li></ol>
</figure>

## Data and recovery

Preserve PostgreSQL, the NFS data directory, the administrator token, and database credentials. Attachments and other `/data` state must accompany the database backup. The original deployment’s data and keys must remain consistent during recovery.

## Availability and failure behavior

**Not HA at the application layer: one vault server; PostgreSQL alone is replicated.**

The expected behavior assumes healthy replicas with the intended placement and reachable dependencies. Verify it in a failure drill on your deployment.

### Component redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Vaultwarden | 1 Recreate replica | There is no hot application process to receive requests on failure. |
| PostgreSQL | 2 CNPG instances on separate local volumes | Preferred synchronous policy and primary promotion protect a database copy. |
| Attachments / app data | Shared NFS /data | Persistent files remain an external dependency. |
| Clients | Possible local encrypted cache | Offline client behavior is separate from server/API availability. |

### Failover and recovery

After a vault-server failure, Kubernetes must restart it and mount /data before clients can synchronize again. If the same failure removes the database primary, CNPG must also promote its standby. A ready database does not eliminate the application startup outage.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | Server access stops if the single application pod was there. When only the standby database member is lost, the server may continue with reduced database redundancy; loss of the primary adds promotion/reconnection time. |
| RTX worker only | No dedicated voter is involved. The same-cluster API and external storage remain dependencies for restart. |
| A second failure before recovery | Check surviving endpoints and capacity before further maintenance. For replicated data or voting groups, check the remaining copies and quorum. |

Losing the RTX Proxmox host takes down both its worker and control-plane VMs, including the default external API endpoint. Factor that dependency into [whole-host failure testing](/infrastructure/availability/#physical-hosts-and-the-api-endpoint).

### Upgrades and voluntary maintenance

Recreate removes the application process during upgrades. Running two database instances does not make that deployment strategy zero downtime.

### Availability limits

NFS failure affects attachments and other /data state. Preferred synchronous mode allows degraded writes without a standby, so it is not an unconditional zero-loss policy. Database and file backups must be restored consistently.

### Improving availability

Define the accepted synchronization outage and rehearse a database-plus-/data restore. Continuous vault-server HA would need a supported multi-instance application and shared-state design rather than a replica-count edit alone.

See [platform availability](/infrastructure/availability/) for shared dependencies and failure-test criteria.

## Configuration ownership

Keep Kubernetes resources in `apps/vaultwarden/` and environment-specific inputs in `apps/variables.yaml`. Use the application’s backup procedure for any settings it stores in its database.

- [`admin-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/admin-secret.yaml)
- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/database.yaml)
- [`db-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/db-secret.yaml)
- [`storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/storage.yaml)

## Related guides

- [deployment guide](/admin-guide/vaultwarden/) for setup and recovery
- [official documentation](https://github.com/dani-garcia/vaultwarden/wiki) for product configuration
