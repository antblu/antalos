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

Partial availability: web and database tiers are replicated, but scheduler, WebSocket, external object storage, and initialization behavior can interrupt features or upgrades.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

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
