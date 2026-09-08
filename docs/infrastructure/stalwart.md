---
title: "Stalwart Mail \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for Stalwart Mail in Antalos."
---

<nav class="guide-switcher" aria-label="Stalwart Mail guide sections"><a href="/user-guide/stalwart/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/stalwart/">Infrastructure Explanation</a><a href="/admin-guide/stalwart/">Deployment and Admin Guide</a></nav>

Two Stalwart replicas share a two-instance PostgreSQL cluster, Garage blob storage, Redis, and Elasticsearch. Redis has two data members and three Sentinel voters, but its HAProxy endpoint is colocated with the RTX quorum pod. Elasticsearch has two data/master members and a third master-only voter. A bootstrap Job applies the initial declarative settings; mail protocol listeners and HTTPS use separate routing paths.

## Component boundaries

<figure class="architecture-diagram" aria-label="Stalwart Mail · component flow">
<div class="diagram-heading">Stalwart Mail · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Mail clients</span><ul><li>SMTP / IMAP / other listeners</li><li>HTTPS administration</li></ul></li><li class="diagram-stage"><span class="diagram-label">Mail processing</span><ul><li>2 Stalwart replicas</li><li>Bootstrap settings Job</li></ul></li><li class="diagram-stage"><span class="diagram-label">Mail state</span><ul><li>PostgreSQL / Garage blobs</li><li>Redis → proxy on RTX</li><li>Elasticsearch · 2 data + 1 voter</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Back up PostgreSQL, Garage message blobs, sealed credentials, signing material, and declarative bootstrap configuration. Mail identity also depends on external DNS records. Replicated search and cache components are not independent backups of mailboxes.

## Availability and failure behavior

**Availability classification: Partially HA; loss of the RTX-only Redis proxy is an explicit single-worker failure gap.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Mail processes | 2 anti-affined Stalwart replicas | Protocol Services can route new sessions to a surviving server. |
| PostgreSQL | 2 CNPG members | No synchronous policy is declared; promotion is separate from mail process routing. |
| Redis data / votes | 2 data + 3 Sentinels | Intended primary election requires working voter communication. |
| Redis client endpoint | 1 HAProxy in the RTX quorum pod | All configured Redis access depends on this one pod even with healthy data members. |
| Search | 2 data/master nodes + 1 master-only RTX node | A majority can elect; actual shard replica allocation determines data survival. |
| Message blobs | External Garage endpoint | Mailbox contents still depend on the external object service. |

### How a failure is handled

A surviving Stalwart replica can accept a new protocol connection when its database, Redis endpoint, and blob store are available. PostgreSQL promotion and Redis election can interrupt that path. Elasticsearch majority protects master election only; a ready search process does not prove every needed shard has another copy.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | One mail replica and data member per paired backend may remain. A failed primary requires promotion/election and client reconnect. The custom Redis configuration’s restart and authentication caveats still apply. |
| RTX worker only | The Stalwart Redis Service selects the sole proxy inside redis-quorum on RTX. Losing RTX removes that endpoint, not just a third vote; Redis-dependent mail operations can fail while both Redis data members are alive. Search also loses its master-only member. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

Stalwart’s StatefulSet updates its processes incrementally and has a PDB minimum 1. The Redis quorum/proxy Deployment uses Recreate, so updating that singleton can interrupt Redis access for both mail replicas.

### What prevents a stronger HA claim

Redis startup derives roles from ordinal names, writes Sentinel topology to /tmp, and requires matching authentication and discovery settings across the voters and clients. Safe election/rejoin must be established. PostgreSQL can lag; Garage is external; Elasticsearch shard replicas are not proven by its pod count.

### What would improve the availability contract

Remove the single Redis client-path dependency through a supported replicated proxy or native discovery design, establish election/rejoin correctness, and record SMTP, mailbox read, search, and blob access during failure. Protect external storage and verify per-index shard allocation.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/stalwart/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/database.yaml)
- [`elasticsearch.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/elasticsearch.yaml)
- [`redis.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/redis.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/secrets.yaml)
- [`stalwart.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/stalwart.yaml)

## Continue

Read the [deployment guide](/admin-guide/stalwart/) for dependency order, initial credentials, and integration work. The [official documentation](https://stalw.art/docs/) explains the upstream product; the topology above describes this repository.
