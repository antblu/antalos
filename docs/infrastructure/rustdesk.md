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

Recovery-based rendezvous with replicated native relay choices. Active sessions on a failed relay reconnect; secure WebSocket traffic uses the first relay path. The single NFS backend and hbbs restart remain availability boundaries. A lock is not infrastructure fencing during a node partition.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

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
