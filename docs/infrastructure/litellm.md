---
title: "LiteLLM \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for LiteLLM in Antalos."
---

<nav class="guide-switcher" aria-label="LiteLLM guide sections"><a href="/user-guide/litellm/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/litellm/">Infrastructure Explanation</a><a href="/admin-guide/litellm/">Deployment and Admin Guide</a></nav>

Two anti-affined proxy replicas use `litellm-db`, a two-instance CloudNativePG cluster. Redis provides coordination and authentication caching through two persistent data members and three authenticated Sentinel voters, with the third voter on RTX. Clients discover the primary directly from Sentinel, avoiding a single Redis proxy endpoint. Response caching is not enabled. One process runs per proxy pod.

## Component boundaries

<figure class="architecture-diagram" aria-label="LiteLLM · component flow">
<div class="diagram-heading">LiteLLM · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Consumers</span><ul><li>Open WebUI / API clients</li><li>Virtual key → HTTPS /v1</li></ul></li><li class="diagram-stage"><span class="diagram-label">Gateway</span><ul><li>2 proxy replicas</li><li>One schema-migration hook</li></ul></li><li class="diagram-stage"><span class="diagram-label">Coordination / state</span><ul><li>PostgreSQL · 2 instances</li><li>Redis · 2 data / 3 Sentinels</li><li>Configured model providers</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

PostgreSQL stores model configuration, keys, and administration state. Preserve the original `litellm-app` salt key to decrypt stored provider credentials. Redis state is asynchronous; the configuration does not declare an off-cluster PostgreSQL backup.

## Availability and failure behavior

**Availability classification: HA design for a single data-worker loss, conditional on healthy control-plane, Sentinel communication, and upstream providers.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Proxy | 2 anti-affined replicas on the main workers | Stateless request routing; zero-surge rollout and PDB minimum 1. |
| PostgreSQL | 2 CNPG members on separate local volumes | A surviving standby is promoted; method any, number 1, durability preferred. |
| Redis data | 2 persistent members; one Sentinel beside each | Asynchronous replication, writable saved Redis roles and Sentinel topology. |
| Third voter | 1 Sentinel on RTX | Provides the third vote; the shared Sentinel PDB retains 2 voters for voluntary eviction. |
| Client connection | Direct discovery from all 3 Sentinel endpoints | No single HAProxy pod between LiteLLM and Redis. |

### How a failure is handled

If the failed worker owns the Redis primary, the two surviving voters can authorize promotion when quorum and peer authentication are working. LiteLLM rediscovers the primary. CNPG independently promotes its surviving PostgreSQL standby if needed, and incoming requests retry against the remaining proxy. The startup scripts query reachable Sentinels and preserve data-side topology so a returned member can rejoin the elected primary.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | One proxy, one PostgreSQL instance, one Redis data member, and two Sentinel voters remain. Availability is reduced while promotion and client reconnection happen; replacement data members remain constrained to the two main workers. |
| RTX worker only | The two data-side Sentinels and both proxies remain. Direct discovery avoids making the RTX-only voter the Redis access endpoint, although another voter loss would remove failover tolerance. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

Proxy updates retain one pod. A single Sync hook runs the schema migration before new proxies start; migration failure intentionally blocks rollout. Backward-incompatible schema changes may still require a maintenance window.

### What prevents a stronger HA claim

In-flight streams do not migrate. Redis replication and AOF every-second fsync do not guarantee zero loss. Preferred synchronous PostgreSQL also allows degraded writes without a standby. No off-cluster database backup is configured. Network partitions and correlated control-plane failures require separate evidence.

### What would improve the availability contract

Record a real API request during primary loss, verify returned-member roles and all Sentinel peer connections, and establish a database backup with the original salt key. Provider/network availability needs its own assessment.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/litellm/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/app.yaml)
- [`availability.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/availability.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/certificate.yaml)
- [`config.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/config.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/database.yaml)
- [`deployment.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/deployment.yaml)
- [`migration.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/migration.yaml)
- [`redis.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/redis.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/secrets.yaml)

## Continue

Read the [deployment guide](/admin-guide/litellm/) for dependency order, initial credentials, and integration work. The [official documentation](https://docs.litellm.ai/docs/) explains the upstream product; the topology above describes this repository.
