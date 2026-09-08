---
title: "RustDesk \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for RustDesk in Antalos."
---

<nav class="guide-switcher" aria-label="RustDesk guide sections"><a href="/user-guide/rustdesk/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/rustdesk/">Infrastructure Explanation</a><a href="/admin-guide/rustdesk/">Deployment and Admin Guide</a></nav>

One `hbbs` Deployment provides rendezvous/ID service. Two `hbbr` StatefulSet pods provide independent relays, with one Service per ordinal. Traefik maps distinct advertised ports to those relay processes so both sides of a session meet at the same relay. The live hbbs SQLite database uses local `emptyDir`; Litestream copies it to an NFS backup and restores it at startup. An NFS lock serializes writers.

## Component boundaries

<figure class="architecture-diagram" aria-label="RustDesk · component flow">
<div class="diagram-heading">RustDesk · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Clients</span><ul><li>Native ID / TCP + UDP</li><li>WSS via Traefik</li></ul></li><li class="diagram-stage"><span class="diagram-label">Session services</span><ul><li>1 hbbs / rendezvous + SQLite</li><li>2 hbbr / separately pinned relays</li></ul></li><li class="diagram-stage"><span class="diagram-label">Continuity</span><ul><li>hbbs → Litestream → NFS</li><li>Sealed identity shared by servers</li><li>Relay pairing stays in memory</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Preserve the Litestream backup and the `rustdesk-identity` sealed private key. The public key is supplied in `apps/rustdesk/public-key.txt`. Replacing the identity changes what clients trust. A one-second copy interval is a backup target, not a guaranteed recovery point.

## Availability and failure behavior

**Availability classification: Not continuously HA end to end: one recoverable rendezvous server, with two independent native relays.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| hbbs | 1 Deployment replica | Kubernetes replacement and NFS restore are required after process loss. |
| hbbr | 2 StatefulSet pods on separate nodes | Each has its own routed endpoint; relay pairing is process-local. |
| SQLite | Local emptyDir + Litestream copy to NFS | Replacement restores the latest available copy before starting. |
| Identity / writer ownership | Sealed server key + exclusive NFS lock | Identity survives restart; the lock serializes restore/writer startup but is not node fencing. |

### How a failure is handled

For hbbs failure, detection, eviction, scheduling, image startup, lock acquisition, and SQLite restore all precede service recovery. For native relay failure, hbbs can select the other advertised relay for new connections. Both participants in one relay session must reach the same process, so a generic load-balanced Service across both relays would not provide correct pairing.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | If hbbs is on the failed node, new rendezvous waits for restart/restore. The surviving relay can serve new native relay sessions once clients can coordinate; sessions on the failed relay reconnect. Some established direct peer connections may remain, but they do not prove new-session availability. |
| RTX worker only | No dedicated quorum voter is needed. Access still depends on ingress/network and a working Kubernetes recovery path. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

The single hbbs uses zero surge and one unavailable, so updates interrupt it. Its PDB minimum 1 blocks ordinary eviction of the only replica. Relay StatefulSet updates replace ordinals sequentially; secure WebSocket paths on 443/21119 target the first relay and are not equivalent to the two native relay choices.

### What prevents a stronger HA claim

The NFS backup server is a single dependency. Async copy lag can lose recent registration changes; the configured one-second interval is not an RPO guarantee. During a partition, the old process must be fenced before forcing a replacement; deleting a lock is not fencing.

### What would improve the availability contract

Measure rendezvous recovery separately from relay continuity, protect the NFS backup and original key, and exercise direct/native relay/WSS paths separately. Continuous hbbs availability needs a supported design beyond adding a second SQLite writer.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/rustdesk/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/rustdesk/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/rustdesk/certificate.yaml)
- [`config.yaml`](https://github.com/antblu/antalos/blob/main/apps/rustdesk/config.yaml)
- [`hbbr.yaml`](https://github.com/antblu/antalos/blob/main/apps/rustdesk/hbbr.yaml)
- [`hbbs.yaml`](https://github.com/antblu/antalos/blob/main/apps/rustdesk/hbbs.yaml)
- [`ingress.yaml`](https://github.com/antblu/antalos/blob/main/apps/rustdesk/ingress.yaml)
- [`secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/rustdesk/secret.yaml)
- [`services.yaml`](https://github.com/antblu/antalos/blob/main/apps/rustdesk/services.yaml)
- [`storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/rustdesk/storage.yaml)

## Continue

Read the [deployment guide](/admin-guide/rustdesk/) for dependency order, initial credentials, and integration work. The [official documentation](https://rustdesk.com/docs/en/) explains the upstream product; the topology above describes this repository.
