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

The serving and data tiers tolerate a single worker failure with an election/promotion interval. In-flight streams are interrupted. Preferred synchronous PostgreSQL settings allow writes without a standby; this and asynchronous Redis replication limit durability guarantees.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

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
