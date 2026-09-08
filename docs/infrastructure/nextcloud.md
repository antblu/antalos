---
title: "Nextcloud \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for Nextcloud in Antalos."
---

<nav class="guide-switcher" aria-label="Nextcloud guide sections"><a href="/user-guide/nextcloud/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/nextcloud/">Infrastructure Explanation</a><a href="/admin-guide/nextcloud/">Deployment and Admin Guide</a></nav>

Two Nextcloud web pods each include notify_push. Shared app code comes from the `nextcloud-apps` NFS volume; runtime files are pod-local. A two-instance CNPG cluster stores application metadata and Context Chat data. Garage is the primary file object store. Redis uses two persistent data members, three Sentinel voters, and two HAProxy replicas. Separate deployments run EuroOffice, Whiteboard, and the request/update/indexing roles of Context Chat. Talk has two signaling/Janus/TURN pods and three NATS members.

## Component boundaries

<figure class="architecture-diagram" aria-label="Nextcloud · component flow">
<div class="diagram-heading">Nextcloud · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Clients</span><ul><li>Browser / sync / DAV</li><li>Traefik HTTPS</li></ul></li><li class="diagram-stage"><span class="diagram-label">Collaboration</span><ul><li>2 web + notify_push pods</li><li>Office / Whiteboard / Context Chat</li><li>Talk × 2 / NATS × 3</li></ul></li><li class="diagram-stage"><span class="diagram-label">Shared dependencies</span><ul><li>PostgreSQL · 2 instances</li><li>Redis · 2 data / 3 voters / 2 proxies</li><li>Garage files / NFS app code</li></ul></li></ol>
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

Most serving components are replicated, while NFS and Garage remain external dependencies. Office and Talk sessions can reconnect after their owning process fails. Talk recording is external to this repository and has no availability guarantee defined by these manifests.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

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
