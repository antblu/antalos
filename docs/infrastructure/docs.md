---
title: "Antalos documentation \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for Antalos documentation in Antalos."
---

<nav class="guide-switcher" aria-label="Antalos documentation guide sections"><a href="/user-guide/docs/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/docs/">Infrastructure Explanation</a><a href="/admin-guide/docs/">Deployment and Admin Guide</a></nav>

Astro Starlight reads Markdown from `docs/` through `site/src/content.config.ts`. The static build is copied into an unprivileged NGINX image and published by GitHub Actions. Two stateless NGINX replicas serve the image on port 8080 behind a Kubernetes Service and Traefik. cert-manager manages `docs-tls`.

## Component boundaries

<figure class="architecture-diagram" aria-label="Antalos documentation · component flow">
<div class="diagram-heading">Antalos documentation · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Build</span><ul><li>docs/ + site/</li><li>Astro → image in GHCR</li></ul></li><li class="diagram-stage"><span class="diagram-label">Delivery</span><ul><li>Argo CD → Deployment</li><li>2 NGINX replicas</li></ul></li><li class="diagram-stage"><span class="diagram-label">Read</span><ul><li>Service ← Traefik HTTPS</li><li>Reader / static search index</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Content, CSS, components, navigation, and build definitions live in Git. The serving pods have no application database. Preserve the source repository and access to published images for recovery.

## Availability and failure behavior

Two anti-affined serving replicas and a disruption budget cover one serving-node failure. Ingress and DNS remain shared dependencies. The declared `maxSurge: 1` / `maxUnavailable: 0` rollout needs a spare eligible node under required anti-affinity. With only two eligible workers, it can stall until that scheduling or rollout constraint is addressed.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/docs/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/docs/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/docs/certificate.yaml)
- [`deployment.yaml`](https://github.com/antblu/antalos/blob/main/apps/docs/deployment.yaml)

## Continue

Read the [deployment guide](/admin-guide/docs/) for dependency order, initial credentials, and integration work. The [official documentation](https://starlight.astro.build/) explains the upstream product; the topology above describes this repository.
