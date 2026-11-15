---
title: "LiteLLM · Architecture"
description: "LiteLLM gateway, model providers, and persistent access configuration."
---

<nav class="guide-switcher" aria-label="LiteLLM guide sections"><a href="/user-guide/litellm/">Use</a><a aria-current="page" href="/infrastructure/litellm/">Architecture</a><a href="/admin-guide/litellm/">Operate</a></nav>

Two anti-affined proxy replicas use `litellm-db`, a two-instance CloudNativePG cluster. Redis provides coordination and authentication caching through two persistent data members and three authenticated Sentinel voters, with the third voter on RTX. Clients discover the primary directly from Sentinel, avoiding a single Redis proxy endpoint. Separate CronJobs discover models from the llama.cpp and Speaches OpenAI-compatible endpoints and add missing deployments through LiteLLM's database-backed management API. Response caching is not enabled. One process runs per proxy pod.

## Components

<figure class="architecture-diagram" aria-label="LiteLLM · component flow">
<div class="diagram-heading">LiteLLM · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Consumers</span><ul><li>Open WebUI / API clients</li><li>Virtual key → HTTPS /v1</li></ul></li><li class="diagram-stage"><span class="diagram-label">Gateway</span><ul><li>2 proxy replicas</li><li>One schema-migration hook</li><li>Two model-discovery CronJobs</li></ul></li><li class="diagram-stage"><span class="diagram-label">Coordination / state</span><ul><li>PostgreSQL · 2 instances</li><li>Redis · 2 data / 3 Sentinels</li><li>llama.cpp and Speaches catalogs</li></ul></li></ol>
</figure>

## Data and recovery

PostgreSQL stores model configuration, keys, and administration state. Preserve the original `litellm-app` salt key to decrypt stored provider credentials. Redis state is asynchronous; the configuration does not declare an off-cluster PostgreSQL backup.

Discovered models are additive. The controller uses the upstream ID's final path component as the public LiteLLM name and stores `openai/<upstream-id>` as its internal route. It retains the complete upstream ID in discovery metadata and uses that metadata, plus a deterministic deployment ID, to make reconciliation idempotent. It deliberately does not prune missing upstream entries or modify existing names. This makes upstream catalog outages non-destructive and leaves lifecycle removal as an explicit administrator action.

## Availability and failure behavior

**HA design for a single data-worker loss, conditional on healthy control-plane, Sentinel communication, and upstream providers.**

The expected behavior assumes healthy replicas with the intended placement and reachable dependencies. Verify it in a failure drill on your deployment.

### Component redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Proxy | 2 anti-affined replicas on the main workers | Stateless request routing; zero-surge rollout and PDB minimum 1. |
| PostgreSQL | 2 CNPG members on separate local volumes | A surviving standby is promoted; method any, number 1, durability preferred. |
| Redis data | 2 persistent members; one Sentinel beside each | Asynchronous replication, writable saved Redis roles and Sentinel topology. |
| Third voter | 1 Sentinel on RTX | Provides the third vote; the shared Sentinel PDB retains 2 voters for voluntary eviction. |
| Client connection | Direct discovery from all 3 Sentinel endpoints | No single HAProxy pod between LiteLLM and Redis. |

### Failover and recovery

If the failed worker owns the Redis primary, the two surviving voters can authorize promotion when quorum and peer authentication are working. LiteLLM rediscovers the primary. CNPG independently promotes its surviving PostgreSQL standby if needed, and incoming requests retry against the remaining proxy. The startup scripts query reachable Sentinels and preserve data-side topology so a returned member can rejoin the elected primary.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | One proxy, one PostgreSQL instance, one Redis data member, and two Sentinel voters remain. Availability is reduced while promotion and client reconnection happen; replacement data members remain constrained to the two main workers. |
| RTX worker only | The two data-side Sentinels and both proxies remain. Direct discovery avoids making the RTX-only voter the Redis access endpoint, although another voter loss would remove failover tolerance. |
| A second failure before recovery | Check surviving endpoints and capacity before further maintenance. For replicated data or voting groups, check the remaining copies and quorum. |

Losing the RTX Proxmox host takes down both its worker and control-plane VMs, including the default external API endpoint. Factor that dependency into [whole-host failure testing](/infrastructure/availability/#physical-hosts-and-the-api-endpoint).

### Upgrades and voluntary maintenance

Proxy updates retain one pod. A single Sync hook runs the schema migration before new proxies start; migration failure intentionally blocks rollout. Backward-incompatible schema changes may still require a maintenance window.

### Availability limits

In-flight streams do not migrate. Redis replication and AOF every-second fsync do not guarantee zero loss. Preferred synchronous PostgreSQL also allows degraded writes without a standby. No off-cluster database backup is configured. Network partitions and correlated control-plane failures require separate evidence.

### Improving availability

Record a real API request during primary loss, verify returned-member roles and all Sentinel peer connections, and establish a database backup with the original salt key. Provider/network availability needs its own assessment.

See [platform availability](/infrastructure/availability/) for shared dependencies and failure-test criteria.

## Configuration ownership

Keep Kubernetes resources in `apps/litellm/` and environment-specific inputs in `apps/variables.yaml`. Use the application’s backup procedure for any settings it stores in its database.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/app.yaml)
- [`availability.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/availability.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/certificate.yaml)
- [`config.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/config.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/database.yaml)
- [`deployment.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/deployment.yaml)
- [`migration.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/migration.yaml)
- [`model-discovery.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/model-discovery.yaml)
- [`redis.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/redis.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/secrets.yaml)

## Related guides

- [deployment guide](/admin-guide/litellm/) for setup and recovery
- [official documentation](https://docs.litellm.ai/docs/) for product configuration
