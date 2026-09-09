---
title: "SuiteCRM \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for SuiteCRM in Antalos."
---

<nav class="guide-switcher" aria-label="SuiteCRM guide sections"><a href="/user-guide/suitecrm/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/suitecrm/">Infrastructure Explanation</a><a href="/admin-guide/suitecrm/">Deployment and Admin Guide</a></nav>

SuiteCRM is deployed as several cooperating Kubernetes workloads rather than one self-contained pod. Two web replicas serve interactive traffic, a singleton messenger consumes asynchronous work, a CronJob starts the SuiteCRM scheduler every minute, and an Argo CD hook Job installs or upgrades the shared application tree. The MariaDB operator manages two Galera data members on the main workers; a `garbd` process on RTX contributes a third vote without storing SQL data.

Persistence is deliberately split by access pattern. The application tree is shared through NFS, each database member owns a separate node-local OpenEBS volume, caches and web sessions are disposable pod-local volumes, and SuiteCRM media plus physical database backups are stored through the Garage S3 API. These layers are not interchangeable and must be recovered differently.

## Component boundaries

<figure class="architecture-diagram" aria-label="SuiteCRM · component flow">
<div class="diagram-heading">SuiteCRM · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Request path</span><ul><li>Browser → Traefik HTTPS</li><li>Sticky cookie → 1 of 2 web pods</li></ul></li><li class="diagram-stage"><span class="diagram-label">Application workloads</span><ul><li>Shared NFS application tree</li><li>Local cache and web sessions</li><li>Messenger + scheduler + bootstrap</li></ul></li><li class="diagram-stage"><span class="diagram-label">Durable data</span><ul><li>2 Galera data disks + RTX vote</li><li>Media and DB backups → Garage</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## Kubernetes deployment model

| Resource | Purpose | Placement and lifecycle |
| --- | --- | --- |
| `Deployment/suitecrm` | Runs Apache/PHP and serves the SuiteCRM UI and APIs. | Two replicas are required on different main workers. Rolling updates use `maxSurge: 0` and `maxUnavailable: 1`. |
| `Service/suitecrm` and `Ingress/suitecrm` | Route HTTPS traffic from Traefik to ready web pods. | The Service enables a secure, HTTP-only sticky cookie because PHP session files are local to one web pod. |
| `Job/suitecrm-bootstrap` | Copies the packaged release into the shared application tree when needed, installs repository-owned SAML integration files, installs SuiteCRM, prepares messenger transports, and clears the Symfony cache. | Runs as an Argo CD Sync hook before the long-running application workloads. It must be a single writer during installation or upgrade. |
| `CronJob/suitecrm-scheduler` | Runs `php bin/console schedulers:run` every minute. | Each short-lived Job mounts the shared application tree and receives a fresh local cache. `Forbid` prevents overlapping scheduler Jobs. |
| `Deployment/suitecrm-messenger` | Consumes SuiteCRM's `internal-async` queue, including approved SuiteCRM 8.10 manual media migrations. | One replica provides restart-based recovery, not concurrent background-worker availability. |
| `MariaDB/suitecrm-db` | Creates the two-member Galera database and its Services through mariadb-operator. | One data member is placed on each main worker. The operator controls membership, recovery, and rolling order. |
| `Deployment/suitecrm-garbd` | Supplies the third Galera vote. | Runs only on the tainted RTX worker. It has no application database and needs no persistent volume. |
| `PhysicalBackup/suitecrm-db-daily` | Takes a daily compressed physical database backup from a preferred replica. | Uses temporary OpenEBS staging storage, then writes the completed backup below the `database` prefix in Garage. |

## Storage layers and volumes

### Durable Kubernetes volumes

| Volume or claim | Backend and access | Mounted by | Contents and operational meaning |
| --- | --- | --- | --- |
| `PV/suitecrm-data` and `PVC/suitecrm-data` | External NFS, `ReadWriteMany`, reclaim policy `Retain` | Bootstrap, both web pods, scheduler Jobs, and messenger | The shared `/var/www/html` application tree: installed SuiteCRM code, generated configuration, extensions, logs, and other application runtime files. Legacy uploads remain here until SuiteCRM's manual migration moves them. This volume does **not** contain MariaDB data. |
| MariaDB data claims generated from `spec.storage` | `openebs-local`, `ReadWriteOnce`, `${SUITECRM_DATABASE_STORAGE_SIZE}` for each Galera member | One MariaDB pod per claim | The actual InnoDB/Galera database files. Each claim is node-local; Galera, not OpenEBS, creates the second data copy. Never mount one member's data claim into the other member. |
| `galera-suitecrm-db-0` and `galera-suitecrm-db-1` | `openebs-local`, `ReadWriteOnce`, 100 MiB each | The corresponding MariaDB member's init container, agent, and server | Per-member Galera configuration shared between mariadb-operator components. These small claims are predeclared because the storage class waits for a consumer and the Galera configuration volume is otherwise operator-generated. They are not database backups and do not hold a second SQL dataset. |
| Physical-backup staging claim | Temporary `openebs-local`, `ReadWriteOnce`, sized from `${SUITECRM_DATABASE_STORAGE_SIZE}` | The active physical-backup Job | Scratch space used while mariadb-operator prepares and compresses an external backup. It is cleaned after the backup. Losing it invalidates that run but does not remove an already completed Garage object. |

The NFS claim is intentionally static and retained. Deleting the SuiteCRM namespace or Argo CD Application must not be assumed to delete or recreate the NFS export. MariaDB data claims are separate StatefulSet-style storage and are retained independently of the manifests unless an operator retention action explicitly removes them.

### Disposable pod-local volumes

| Volume | Workloads and mount path | Why it is local | Loss behavior |
| --- | --- | --- | --- |
| `cache` `emptyDir` | Bootstrap at `/mnt/suitecrm-data/suitecrm8/cache`; web, scheduler, and messenger at `/var/www/html/cache` | Symfony cache files are regenerated and are unsafe for concurrent mutation on the shared NFS tree. Each pod or Job gets an isolated cache. | Deleted with the pod and rebuilt on startup or the next command. Do not back it up or restore it. |
| `sessions` `emptyDir` | Web pods at `/var/www/html/var/sessions` | PHP sessions are lock-heavy mutable files. Keeping them local avoids cross-pod and NFS locking problems; Traefik's sticky cookie keeps a browser on the pod that owns its session. | A web pod restart removes its sessions and can sign out users pinned to that pod. The other replica's sessions are unaffected. |
| `saml-provisioning` ConfigMap volume | Bootstrap at `/mnt/saml-provisioning` | Projects the Git-managed SAML extension into the bootstrap Job; it is configuration, not application data. | Recreated from the ConfigMap on every Job. Its source is Git, so it is not part of the NFS backup. |

`emptyDir` means pod-scoped storage on the Kubernetes node; it does not mean a directory on `suitecrm-data`. A replacement pod receives an empty volume even when it is scheduled back to the same worker.

### Garage S3 object storage

Garage is accessed over the S3 API and is not mounted as a filesystem volume. SuiteCRM's 8.9+ Flysystem media configuration maps private documents, public documents, private images, public images, and archived documents to `${SUITECRM_S3_BUCKET}`. On SuiteCRM 8.10, this covers Document files, Note attachments, custom File fields, Image fields, and archived media. The web, scheduler, messenger, and bootstrap containers all receive the same sealed S3 credentials because uploads, lifecycle cleanup, and manual migrations can execute in different workloads.

The same bucket also receives mariadb-operator physical backups under the `database` prefix. Co-location does not make one feature a backup of the other: the `PhysicalBackup` resource protects MariaDB only, and SuiteCRM's media objects require their own Garage durability and recovery policy. Existing legacy Document, Note, Contact, Lead, or Target files remain on NFS until the applicable SuiteCRM 8.10 **Admin → Migrations** task completes successfully.

## State and recovery contract

A complete recovery point has three coordinated parts: a MariaDB physical backup, a copy or snapshot of `suitecrm-data`, and protection of the SuiteCRM Garage bucket containing media. Preserve the matching Git revision and sealed database, application, S3, SAML, and registry Secrets. The database backup does not include NFS or media objects, even though database backups and media share a bucket.

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
| Shared state / media / backups | NFS application tree + Garage media and physical backups | Neither external backend is made HA by web replicas or Galera. |

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

NFS failure affects every SuiteCRM workload that needs the shared application tree. Garage failure prevents new media access and physical-backup writes even while cached pages and database queries remain available. Daily `PhysicalBackup` covers the database, not the NFS tree or media objects. Galera membership does not guarantee that queued jobs ran exactly once or that a partitioned node can safely be forced back online.

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
