---
title: "Vaultwarden \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for Vaultwarden in Antalos."
---

<nav class="guide-switcher" aria-label="Vaultwarden guide sections"><a href="/user-guide/vaultwarden/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/vaultwarden/">Infrastructure Explanation</a><a href="/admin-guide/vaultwarden/">Deployment and Admin Guide</a></nav>

One Vaultwarden application replica uses the chart’s Recreate strategy. PostgreSQL runs as a two-instance CNPG cluster, while `/data` is a retained shared NFS volume. Traefik provides HTTPS using `vaultwarden-tls`. Public signup is disabled and the chart references a sealed administrator token.

## Component boundaries

<figure class="architecture-diagram" aria-label="Vaultwarden · component flow">
<div class="diagram-heading">Vaultwarden · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Vault clients</span><ul><li>Bitwarden-compatible clients</li><li>Application authentication / HTTPS</li></ul></li><li class="diagram-stage"><span class="diagram-label">Vault server</span><ul><li>1 application replica</li><li>Recreate updates</li></ul></li><li class="diagram-stage"><span class="diagram-label">Durable state</span><ul><li>PostgreSQL · 2 instances</li><li>NFS /data + sealed credentials</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Preserve PostgreSQL, the NFS data directory, the administrator token, and database credentials. Attachments and other `/data` state must accompany the database backup. The original deployment’s data and keys must remain consistent during recovery.

## Availability and failure behavior

**Availability classification: Not HA at the application layer: one vault server; PostgreSQL alone is replicated.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Vaultwarden | 1 Recreate replica | There is no hot application process to receive requests on failure. |
| PostgreSQL | 2 CNPG instances on separate local volumes | Preferred synchronous policy and primary promotion protect a database copy. |
| Attachments / app data | Shared NFS /data | Persistent files remain an external dependency. |
| Clients | Possible local encrypted cache | Offline client behavior is separate from server/API availability. |

### How a failure is handled

After a vault-server failure, Kubernetes must restart it and mount /data before clients can synchronize again. If the same failure removes the database primary, CNPG must also promote its standby. A ready database does not eliminate the application startup outage.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | Server access stops if the single application pod was there. When only the standby database member is lost, the server may continue with reduced database redundancy; loss of the primary adds promotion/reconnection time. |
| RTX worker only | No dedicated voter is involved. The same-cluster API and external storage remain dependencies for restart. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

Recreate removes the application process during upgrades. Running two database instances does not make that deployment strategy zero downtime.

### What prevents a stronger HA claim

NFS failure affects attachments and other /data state. Preferred synchronous mode allows degraded writes without a standby, so it is not an unconditional zero-loss policy. Database and file backups must be restored consistently.

### What would improve the availability contract

Define the accepted synchronization outage and rehearse a database-plus-/data restore. Continuous vault-server HA would need a supported multi-instance application and shared-state design rather than a replica-count edit alone.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/vaultwarden/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`admin-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/admin-secret.yaml)
- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/database.yaml)
- [`db-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/db-secret.yaml)
- [`storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/storage.yaml)

## Continue

Read the [deployment guide](/admin-guide/vaultwarden/) for dependency order, initial credentials, and integration work. The [official documentation](https://github.com/dani-garcia/vaultwarden/wiki) explains the upstream product; the topology above describes this repository.
