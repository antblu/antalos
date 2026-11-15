---
title: "Zammad · Architecture"
description: "Zammad web, background jobs, search, and persistent data."
---

<nav class="guide-switcher" aria-label="Zammad guide sections"><a href="/user-guide/zammad/">Use</a><a aria-current="page" href="/infrastructure/zammad/">Architecture</a><a href="/admin-guide/zammad/">Operate</a></nav>

The chart runs two NGINX replicas and two Rails replicas with anti-affinity. Scheduler and WebSocket each have one replica. PostgreSQL uses two CNPG instances; Redis has two data members and a third Sentinel voter; Elasticsearch has two data/master members and an RTX master-only voter. Garage supplies object storage, while chart initialization jobs prepare the application.

## Components

<figure class="architecture-diagram" aria-label="Zammad · component flow">
<div class="diagram-heading">Zammad · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Tickets</span><ul><li>Browser / email channels</li><li>Traefik HTTPS</li></ul></li><li class="diagram-stage"><span class="diagram-label">Support platform</span><ul><li>2 NGINX / 2 Rails</li><li>1 scheduler / 1 WebSocket</li></ul></li><li class="diagram-stage"><span class="diagram-label">Data and search</span><ul><li>PostgreSQL pair / Garage objects</li><li>Redis · 2 data + 3 Sentinels</li><li>Elasticsearch · 2 data + 1 voter</li></ul></li></ol>
</figure>

## Data and recovery

Back up PostgreSQL, Garage objects, and application credentials. Elasticsearch indexes can be rebuilt from authoritative application data using the upstream procedure, but search remains degraded until rebuilding completes. Preserve identity and email-channel configuration stored in the database.

## Availability and failure behavior

**Partially HA: paired HTTP tiers and data services, with singleton real-time/background roles and Redis/search caveats.**

The expected behavior assumes healthy replicas with the intended placement and reachable dependencies. Verify it in a failure drill on your deployment.

### Component redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| HTTP | 2 NGINX + 2 Rails replicas | Separate-node placement leaves a serving web path. |
| Async / real-time | 1 scheduler + 1 WebSocket | Feature recovery waits for the single process to restart. |
| PostgreSQL | 2 CNPG members | Preferred synchronous policy and stable read/write Service. |
| Redis | 2 data + 3 Sentinels | Intended discovery/election across main workers and RTX. |
| Elasticsearch | 2 data/master + 1 master-only member | Election redundancy is distinct from per-index shard replication. |
| Attachments | External Garage objects | A shared dependency even if ticket metadata survives. |

### Failover and recovery

A new HTTP request can reach a surviving Rails/NGINX pair once routing converges. Database and Redis primary changes require separate promotion/election and reconnection. Losing scheduler or WebSocket interrupts their features until restart even while the main ticket page loads. Search also needs the relevant shards on surviving data nodes.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | One web path and one member of each paired data tier can remain with two voters. Email polling/background tasks or real-time updates can pause depending on singleton placement. Test attachment retrieval separately from ticket-list rendering. |
| RTX worker only | Removes the third Sentinel and the master-only Elasticsearch member. Two main-worker voters remain if correctly connected; no further independent failure is covered. |
| A second failure before recovery | Check surviving endpoints and capacity before further maintenance. For replicated data or voting groups, check the remaining copies and quorum. |

Losing the RTX Proxmox host takes down both its worker and control-plane VMs, including the default external API endpoint. Factor that dependency into [whole-host failure testing](/infrastructure/availability/#physical-hosts-and-the-api-endpoint).

### Upgrades and voluntary maintenance

Chart init/migration Jobs gate the upgrade. PDB/paired HTTP replicas do not guarantee compatible schema operation or continuous scheduler/WebSocket service. Keep initialization status separate from current HTTP readiness.

### Availability limits

Redis persists role changes and data-side Sentinel topology on each existing PVC. Startup consults Sentinel before rejoining; first migration of an existing dataset requires agreement from two voters. Verify promotion and former-primary rejoin before asserting automatic recovery. Protected Sentinel listeners require matching credentials and working client discovery authentication. Search HA also requires actual replica-shard allocation, which is not established by the three master-eligible processes.

### Improving availability

Establish Redis election/rejoin correctness and shard-copy evidence, protect Garage, and assess whether the deployed version supports replication of scheduler/WebSocket roles. Record email-to-ticket, reply, attachment, and search behavior through one-node loss.

See [platform availability](/infrastructure/availability/) for shared dependencies and failure-test criteria.

## Configuration ownership

Keep Kubernetes resources in `apps/zammad/` and environment-specific inputs in `apps/variables.yaml`. Use the application’s backup procedure for any settings it stores in its database.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/zammad/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/zammad/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/zammad/database.yaml)
- [`elasticsearch.yaml`](https://github.com/antblu/antalos/blob/main/apps/zammad/elasticsearch.yaml)
- [`redis.yaml`](https://github.com/antblu/antalos/blob/main/apps/zammad/redis.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/zammad/secrets.yaml)

## Related guides

- [deployment guide](/admin-guide/zammad/) for setup and recovery
- [official documentation](https://user-docs.zammad.org/en/latest/) for product configuration
