---
title: "Open WebUI \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for Open WebUI in Antalos."
---

<nav class="guide-switcher" aria-label="Open WebUI guide sections"><a href="/user-guide/open-webui/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/open-webui/">Infrastructure Explanation</a><a href="/admin-guide/open-webui/">Deployment and Admin Guide</a></nav>

Two application replicas share `open-webui-db`, a two-instance PostgreSQL cluster with vector support. Redis has two persistent data nodes and a third Sentinel voter on RTX for distributed coordination. Uploaded objects use Garage. A migration Job handles database changes. The chart is configured with `Recreate`, so upgrades can stop both application replicas even though two run during steady state.

## Component boundaries

<figure class="architecture-diagram" aria-label="Open WebUI · component flow">
<div class="diagram-heading">Open WebUI · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Sign-in / chats</span><ul><li>Browser → Authentik OIDC</li><li>Traefik HTTPS</li></ul></li><li class="diagram-stage"><span class="diagram-label">Chat interface</span><ul><li>2 Open WebUI replicas</li><li>Migration Job / Recreate upgrades</li></ul></li><li class="diagram-stage"><span class="diagram-label">State and inference</span><ul><li>PostgreSQL + vectors · 2 instances</li><li>Redis · 2 data / 3 Sentinels</li><li>Garage uploads / model APIs</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Back up PostgreSQL and the Garage bucket together. Preserve the shared `webui-secret-key` across both replicas and recovery, as well as the OIDC and provider credentials. Local application storage is not the authoritative chat or upload database.

## Availability and failure behavior

Partial availability: steady-state replicas and replicated PostgreSQL/Redis support worker loss, but Recreate upgrades, Garage, and upstream model endpoints can interrupt service.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/open-webui/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/app.yaml)
- [`availability.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/availability.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/database.yaml)
- [`migration.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/migration.yaml)
- [`redis.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/redis.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/secrets.yaml)

## Continue

Read the [deployment guide](/admin-guide/open-webui/) for dependency order, initial credentials, and integration work. The [official documentation](https://docs.openwebui.com/) explains the upstream product; the topology above describes this repository.
