---
title: "Zammad \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for Zammad in Antalos."
---

<nav class="guide-switcher" aria-label="Zammad guide sections"><a href="/user-guide/zammad/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/zammad/">Infrastructure Explanation</a><a href="/admin-guide/zammad/">Deployment and Admin Guide</a></nav>

The chart runs two NGINX replicas and two Rails replicas with anti-affinity. Scheduler and WebSocket each have one replica. PostgreSQL uses two CNPG instances; Redis has two data members and a third Sentinel voter; Elasticsearch has two data/master members and an RTX master-only voter. Garage supplies object storage, while chart initialization jobs prepare the application.

## Component boundaries

<figure class="architecture-diagram" aria-label="Zammad · component flow">
<div class="diagram-heading">Zammad · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Tickets</span><ul><li>Browser / email channels</li><li>Traefik HTTPS</li></ul></li><li class="diagram-stage"><span class="diagram-label">Support platform</span><ul><li>2 NGINX / 2 Rails</li><li>1 scheduler / 1 WebSocket</li></ul></li><li class="diagram-stage"><span class="diagram-label">Data and search</span><ul><li>PostgreSQL pair / Garage objects</li><li>Redis · 2 data + 3 Sentinels</li><li>Elasticsearch · 2 data + 1 voter</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Back up PostgreSQL, Garage objects, and application credentials. Elasticsearch indexes can be rebuilt from authoritative application data using the upstream procedure, but search remains degraded until rebuilding completes. Preserve identity and email-channel configuration stored in the database.

## Availability and failure behavior

**Availability classification: Partially HA: paired HTTP tiers and data services, with singleton real-time/background roles and Redis/search caveats.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| HTTP | 2 NGINX + 2 Rails replicas | Separate-node placement leaves a serving web path. |
| Async / real-time | 1 scheduler + 1 WebSocket | Feature recovery waits for the single process to restart. |
| PostgreSQL | 2 CNPG members | Preferred synchronous policy and stable read/write Service. |
| Redis | 2 data + 3 Sentinels | Intended discovery/election across main workers and RTX. |
| Elasticsearch | 2 data/master + 1 master-only member | Election redundancy is distinct from per-index shard replication. |
| Attachments | External Garage objects | A shared dependency even if ticket metadata survives. |

### How a failure is handled

A new HTTP request can reach a surviving Rails/NGINX pair once routing converges. Database and Redis primary changes require separate promotion/election and reconnection. Losing scheduler or WebSocket interrupts their features until restart even while the main ticket page loads. Search also needs the relevant shards on surviving data nodes.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | One web path and one member of each paired data tier can remain with two voters. Email polling/background tasks or real-time updates can pause depending on singleton placement. Test attachment retrieval separately from ticket-list rendering. |
| RTX worker only | Removes the third Sentinel and the master-only Elasticsearch member. Two main-worker voters remain if correctly connected; no further independent failure is covered. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

Chart init/migration Jobs gate the upgrade. PDB/paired HTTP replicas do not guarantee compatible schema operation or continuous scheduler/WebSocket service. Keep initialization status separate from current HTTP readiness.

### What prevents a stronger HA claim

Redis startup reconstructs roles from ordinal names and Sentinel config from /tmp; rejoining after promotion can reintroduce stale roles. Protected Sentinel listeners require matching credentials and working client discovery authentication. Search HA also requires actual replica-shard allocation, which is not established by the three master-eligible processes.

### What would improve the availability contract

Establish Redis election/rejoin correctness and shard-copy evidence, protect Garage, and assess whether the deployed version supports replication of scheduler/WebSocket roles. Record email-to-ticket, reply, attachment, and search behavior through one-node loss.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/zammad/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/zammad/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/zammad/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/zammad/database.yaml)
- [`elasticsearch.yaml`](https://github.com/antblu/antalos/blob/main/apps/zammad/elasticsearch.yaml)
- [`redis.yaml`](https://github.com/antblu/antalos/blob/main/apps/zammad/redis.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/zammad/secrets.yaml)

## Continue

Read the [deployment guide](/admin-guide/zammad/) for dependency order, initial credentials, and integration work. The [official documentation](https://user-docs.zammad.org/en/latest/) explains the upstream product; the topology above describes this repository.
