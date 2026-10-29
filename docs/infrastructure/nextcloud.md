---
title: "Nextcloud · Architecture"
description: "Backend components, persistence, placement, and failure boundaries for Nextcloud in antalos."
---

<nav class="guide-switcher" aria-label="Nextcloud guide sections"><a href="/user-guide/nextcloud/">Use</a><a aria-current="page" href="/infrastructure/nextcloud/">Architecture</a><a href="/admin-guide/nextcloud/">Operate</a></nav>

Two Nextcloud web pods each include notify_push. Shared app code comes from the `nextcloud-apps` NFS volume; runtime files are pod-local. A two-instance CNPG cluster stores application metadata and Context Chat data. Garage is the primary file object store. Redis uses two persistent data members, three Sentinel voters, and two HAProxy replicas. Separate deployments run EuroOffice, Whiteboard, and the request/update/indexing roles of Context Chat. Talk has one replaceable signaling/Janus/TURN pod and three NATS members.

## Component boundaries

<figure class="architecture-diagram" aria-label="Nextcloud · component flow">
<div class="diagram-heading">Nextcloud · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Clients</span><ul><li>Browser / sync / DAV</li><li>Traefik HTTPS</li></ul></li><li class="diagram-stage"><span class="diagram-label">Collaboration</span><ul><li>2 web + notify_push pods</li><li>Office / Whiteboard / Context Chat</li><li>Talk × 1 (replacement failover) / NATS × 3</li></ul></li><li class="diagram-stage"><span class="diagram-label">Shared dependencies</span><ul><li>PostgreSQL · 2 instances</li><li>Redis · 2 data / 3 voters / 2 proxies</li><li>Garage files / NFS app code</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

A recoverable Nextcloud installation needs the database, Garage objects, original secret/salt and credentials, Git configuration, and any NFS content that cannot be re-created. Pinned application code can be downloaded again, but Whiteboard recording files or manually installed extensions on shared storage need separate consideration. Redis locks and disposable pod files do not replace the data backup.

## Storage by purpose

| Storage | Authoritative contents | Recovery treatment |
| --- | --- | --- |
| PostgreSQL | Users, shares, file metadata, calendars, contacts, app settings, Context Chat data | Back up and restore with matching object data |
| Garage S3 | Primary user-file object contents | Preserve the original bucket and a consistent recovery point |
| Git and ConfigMaps | Server configuration, pinned application list and startup hooks | Rebuild from the intended revision |
| Secrets | Instance secret/salt, database, S3, and companion credentials | Preserve original values and sealing private keys |
| NFS apps export | Shared pinned app code, plus any custom or recording content | Re-download pinned code; separately back up non-reconstructable files |
| Redis | Cache, distributed locks, transient coordination | Recreate carefully after authoritative data recovery |
| Pod-local files | Runtime/core files and working directories | Rebuilt at pod start |

The two PostgreSQL instances hold both Nextcloud and the separately declared `ccb` database. The Context Chat database enables the vector extension through the CNPG Database resource. The primary `config.php` comes from `nextcloud-shared-config` and is intentionally read-only.

## Availability and failure behavior

**Availability classification: Partially HA overall: replicated web and many companions, with shared storage, session, Redis recovery, and upgrade limits.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Web / notify_push | 2 anti-affined web-sidecar pairs | The Service can use the surviving ready web pod. |
| PostgreSQL / Context Chat DB | 2 CNPG instances | Primary/standby replication on local volumes; no synchronous policy is declared. |
| Redis | 2 data + 3 Sentinels + 2 HAProxy replicas | Sentinel intends to elect; HAProxy checks AUTH and ROLE to route to a primary. |
| Context Chat | Request, update, and indexing: 2 each | Role-specific Services and PDBs preserve process redundancy; all share database/provider dependencies. |
| Office / Whiteboard | 2 each | Office uses sticky routing; Whiteboard shares Redis and NFS recording state. |
| Talk | 1 replaceable signaling/Janus/TURN pod; 3 NATS nodes | The Deployment replaces the backend on the surviving general worker; interrupted calls and TURN allocations require reconnection. |
| Local model / speech providers | llama-swap and Speaches on `debian-rtx` | Separate VM endpoints; their availability depends on the consuming integration and GPU. |
| Manually installed ExApps | Outside the current left/RTX playbook workload declarations | Existing transcription or translation registrations require a separate runtime inventory. |
| Files / code / recording | Garage + NFS; recorder on `debian-arc` | No storage-host failover or external-recorder HA is defined here. |

### How a failure is handled

A web request can retry against the surviving pod, but file operations still need PostgreSQL, Garage, and Redis locks. PostgreSQL promotion and Redis primary election are separate recovery steps. The two HAProxy processes avoid a single proxy pod, but their ROLE checks do not elect or fence a primary. Companions recover independently: surviving process capacity does not preserve every in-memory editing or call session.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | One copy of each paired role can remain, along with one database instance, one Redis data member, and two voters. The surviving components must reach external storage. An interrupted upload, edit, call, or indexing task may need application-specific retry. |
| RTX worker only | Removes a Redis voter and one NATS member. Both data workers remain; the usual data tiers can continue with reduced fault tolerance. NATS Core membership provides redundant messaging connectivity here, not a persistent replicated log of user calls. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

Web, office, and Context Chat use zero-surge rolling updates. Redis HAProxy uses maxSurge 0 and maxUnavailable 1 on the two general workers. RTX is reserved for its existing quorum voters and node infrastructure. Major Nextcloud upgrades still require the documented isolated maintenance and single-owner schema migration procedure.

### What prevents a stronger HA claim

Redis persists its writable data-role and Sentinel configuration on the data volume, retaining election changes across restarts. Redis startup requires two Sentinels to agree on the current primary and announces replicas through stable DNS, preventing a returning former primary from blindly retaining its writer role. Volume replacement and simultaneous data loss still require a separate recovery procedure. Rejoin and peer-authentication behavior require runtime evidence. Database replication is asynchronous; NFS/Garage and the external recorder remain separate failure domains.

### What would improve the availability contract

Exercise Redis election and safe rejoin behavior, protect shared storage, and exercise file/office/Talk workflows during degraded operation. A warm web replica does not make the whole Nextcloud suite outage-free.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

### Recoverable Talk process

The coupled AIO signaling/Janus/TURN backend uses a one-replica Recreate Deployment with disposable configuration, independent of the three-member NATS quorum. Sixty-second NotReady/unreachable tolerations permit replacement on the surviving general worker. The stable TURN Service selects application labels, not an ordinal pod name. RTX remains unavailable for this process. Node-loss recovery still interrupts calls, streams and TURN allocations; clients must reconnect. The controller-kind migration is placed after the old StatefulSet's prune wave and causes a planned backend restart. This is replacement failover, not simultaneous cross-Janus media HA.

Normal application pod startup retains existing shared GitOps app directories, even if a desired pin changed. Replacing shared app code requires the explicit maintenance installer override followed by a single-owner migration. This avoids activating an uncompleted app upgrade during node recovery.

## Configuration ownership

`apps/nextcloud/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/app.yaml)
- [`availability.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/availability.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/certificate.yaml)
- [`companion-secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/companion-secrets.yaml)
- [`companion-services.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/companion-services.yaml)
- [`config.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/config.yaml)
- [`context-chat-backend.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/context-chat-backend.yaml)
- [`context-chat-secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/context-chat-secrets.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/database.yaml)
- [`metrics.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/metrics.yaml)
- [`redis.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/redis.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/secrets.yaml)
- [`security-headers.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/security-headers.yaml)
- [`storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/storage.yaml)
- [`talk-secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/talk-secrets.yaml)
- [`talk.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/talk.yaml)
- [`well-known.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/well-known.yaml)

## Continue

Read the [deployment guide](/admin-guide/nextcloud/) for dependency order, initial credentials, and integration work. The [official documentation](https://docs.nextcloud.com/server/latest/user_manual/en/) explains the upstream product; the topology above describes this repository.
