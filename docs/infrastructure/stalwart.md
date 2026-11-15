---
title: "Stalwart Mail · Architecture"
description: "Stalwart mail protocols, data stores, and the SMTP edge path."
---

<nav class="guide-switcher" aria-label="Stalwart Mail guide sections"><a href="/user-guide/stalwart/">Use</a><a aria-current="page" href="/infrastructure/stalwart/">Architecture</a><a href="/admin-guide/stalwart/">Operate</a></nav>

Two Stalwart replicas share a two-instance PostgreSQL cluster, Garage blob storage, Redis, and Elasticsearch. Redis has two data members and three Sentinel voters; two independent HAProxy replicas route clients to the current Redis writer. Elasticsearch has two data/master members and a third master-only voter. A bootstrap Job applies the initial declarative settings; mail protocol listeners and HTTPS use separate routing paths.

Public mail protocols follow `Azure HAProxy -> home HAProxy -> source-preserving NodePort -> local Stalwart pod`. Both proxy hops use PROXY protocol v2 so Stalwart applies connection limits and reputation to the actual public client. Only the two home HAProxy addresses are trusted to supply PROXY headers. The separate shared MetalLB Service remains the direct internal-client path and does not preserve public source addresses across the additional cluster hop.

## Components

<figure class="architecture-diagram" aria-label="Stalwart Mail · component flow">
<div class="diagram-heading">Stalwart Mail · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Mail clients</span><ul><li>SMTP / IMAP / other listeners</li><li>HTTPS administration</li></ul></li><li class="diagram-stage"><span class="diagram-label">Mail processing</span><ul><li>2 Stalwart replicas</li><li>Bootstrap settings Job</li></ul></li><li class="diagram-stage"><span class="diagram-label">Mail state</span><ul><li>PostgreSQL / Garage blobs</li><li>Redis → 2 writer-aware proxies</li><li>Elasticsearch · 2 data + 1 voter</li></ul></li></ol>
</figure>

## Data and recovery

Back up PostgreSQL, Garage message blobs, sealed credentials, signing material, and declarative bootstrap configuration. Mail identity also depends on external DNS records. Replicated search and cache components are not independent backups of mailboxes.

## Availability and failure behavior

**Replicated mail/data tiers with writer-aware Redis proxies; shared Garage, routing, and search allocation still bound whole-service availability.**

The expected behavior assumes healthy replicas with the intended placement and reachable dependencies. Verify it in a failure drill on your deployment.

### Component redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Mail processes | 2 anti-affined Stalwart replicas | Public protocol traffic targets local endpoints on both mail workers; direct internal clients use the shared MetalLB Service. |
| PostgreSQL | 2 CNPG members | No synchronous policy is declared; promotion is separate from mail process routing. |
| Redis data / votes | 2 data + 3 Sentinels | Intended primary election requires working voter communication. |
| Redis client endpoint | 2 HAProxy replicas with required hostname anti-affinity | Service routes to a ready proxy; ROLE checks select the writer and DNS resolvers refresh replaced Redis pod addresses. Readiness requires an available writer. |
| Search | 2 data/master nodes + 1 master-only RTX node | A majority can elect; actual shard replica allocation determines data survival. |
| Message blobs | External Garage endpoint | Mailbox contents still depend on the external object service. |

### Failover and recovery

A surviving Stalwart replica can accept a new protocol connection when its database, Redis endpoint, and blob store are available. HAProxy health checks remove a worker NodePort that has no local Stalwart endpoint. PostgreSQL promotion and Redis election can interrupt that path. Elasticsearch majority protects master election only; a ready search process does not prove every needed shard has another copy.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | One mail replica and data member per paired backend may remain. A failed primary requires promotion/election and client reconnect. The custom Redis configuration’s restart and authentication caveats still apply. |
| RTX worker only | Redis loses its third Sentinel vote, while independent proxies continue to route to the writer. With both data workers healthy, two Sentinel voters remain. Search also loses its master-only member. |
| A second failure before recovery | Check surviving endpoints and capacity before further maintenance. For replicated data or voting groups, check the remaining copies and quorum. |

Losing the RTX Proxmox host takes down both its worker and control-plane VMs. Without the optional Talos VIP, it also takes down the external Kubernetes API address. See [physical hosts and the API endpoint](/infrastructure/availability/#physical-hosts-and-the-api-endpoint).

### Upgrades and voluntary maintenance

Stalwart’s StatefulSet updates its processes incrementally and has a PDB minimum 1. The independent Redis proxies use zero-surge rolling updates and a one-available PDB. The third-voter Deployment remains Recreate; keep both data-side voters healthy during its replacement.

### Availability limits

Redis roles and data-side Sentinel topology persist on the existing data PVCs; startup consults Sentinel before rejoining. Stable voter identities prevent replaced pods accumulating obsolete votes. Election/rejoin still needs a failure drill. PostgreSQL can lag; Garage is external; Elasticsearch shard replicas are not proven by its pod count.

### Improving availability

Verify both independent Redis proxies and election/rejoin correctness, and record SMTP, mailbox read, search, and blob access during failure. Protect external storage and verify per-index shard allocation.

See [platform availability](/infrastructure/availability/) for shared dependencies and failure-test criteria.

## Configuration ownership

Keep Kubernetes resources in `apps/stalwart/` and environment-specific inputs in `apps/variables.yaml`. Use the application’s backup procedure for any settings it stores in its database.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/database.yaml)
- [`elasticsearch.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/elasticsearch.yaml)
- [`redis.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/redis.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/secrets.yaml)
- [`stalwart.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/stalwart.yaml)

## Related guides

- [deployment guide](/admin-guide/stalwart/) for setup and recovery
- [official documentation](https://stalw.art/docs/) for product configuration
