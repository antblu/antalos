---
title: "SuiteCRM \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for SuiteCRM in Antalos."
---

<nav class="guide-switcher" aria-label="SuiteCRM guide sections"><a href="/user-guide/suitecrm/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/suitecrm/">Infrastructure Explanation</a><a href="/admin-guide/suitecrm/">Deployment and Admin Guide</a></nav>

Two web replicas share the `suitecrm-data` NFS volume. A single messenger worker and a scheduled CronJob handle background work. The MariaDB operator manages two Galera data members on the main workers; a `garbd` process on RTX adds a third vote without storing a full database. The bootstrap Job initializes the shared installation. Daily physical database backups target Garage.

## Component boundaries

<figure class="architecture-diagram" aria-label="SuiteCRM · component flow">
<div class="diagram-heading">SuiteCRM · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">CRM users</span><ul><li>Browser → SAML</li><li>Traefik HTTPS</li></ul></li><li class="diagram-stage"><span class="diagram-label">Application</span><ul><li>2 web replicas / shared NFS</li><li>1 messenger / scheduler Job</li></ul></li><li class="diagram-stage"><span class="diagram-label">Database and backup</span><ul><li>2 Galera data + RTX garbd vote</li><li>Daily physical backup → Garage</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Back up MariaDB and the NFS application data together, including uploaded files and custom configuration. Preserve the SAML service-provider key and identity-provider certificate. The `PhysicalBackup` resource covers the database; it does not itself back up NFS.

## Availability and failure behavior

**Availability classification: Partially HA: replicated web and Galera data, but background workers and shared files have separate outage paths.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Web | 2 anti-affined replicas | Both mount the same application data export and use the database Service. |
| Database | 2 Galera data members on main workers | Write-set replication and quorum membership retain a surviving data node. |
| Arbitrator | 1 garbd on RTX | Third vote with no database copy; surviving data member plus arbitrator can retain a majority. |
| Background work | 1 messenger process + scheduled CronJob | Restart/scheduling recovery, not two concurrently available workers. |
| Shared state / backups | NFS data + Garage physical backups | Neither external backend is made HA by Galera. |

### How a failure is handled

If a main data node fails while the other node and garbd can communicate, the surviving Primary Component retains two of the original three votes. Ready database routing and the remaining web pod can serve requests after membership changes settle. garbd arbitrates membership; it cannot answer SQL or reconstruct a lost database.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | One web and one database member can remain with the arbitrator. Work owned by the single messenger may pause if that pod was on the failed worker. Remaining capacity and NFS availability still bound the user experience. |
| RTX worker only | Both data members can continue as the surviving majority when connected. With garbd absent, another data-member loss is outside the intended one-failure design; a forced quorum bootstrap requires careful split-brain recovery. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

Web updates use zero surge and one unavailable. MariaDB declares ReplicasFirstPrimaryLast. The messenger is singleton and can pause during its update. A PDB protects evictions, not every scheduled task or a database schema migration.

### What prevents a stronger HA claim

NFS failure affects both web replicas. Daily PhysicalBackup covers the database, not uploaded files/custom application state. Galera membership does not guarantee that queued jobs ran exactly once or that a partitioned node can safely be forced back online.

### What would improve the availability contract

Protect NFS, define background-job outage expectations, and prove a database-plus-files restore. For stronger complete-service HA, assess supported messenger concurrency and capture CRM read/write behavior during membership loss and rejoin.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/suitecrm/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/app.yaml)
- [`backup.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/backup.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/database.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/secrets.yaml)
- [`storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/storage.yaml)
- [`suitecrm.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/suitecrm.yaml)

## Continue

Read the [deployment guide](/admin-guide/suitecrm/) for dependency order, initial credentials, and integration work. The [official documentation](https://docs.suitecrm.com/user/) explains the upstream product; the topology above describes this repository.
