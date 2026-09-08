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

**Availability classification: HA static serving tier for node loss; current zero-unavailable rollout can be blocked by placement.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| NGINX | 2 stateless replicas; required host anti-affinity | The Service routes to ready copies of the same image. |
| Persistent state | None in serving pods | Pages and search assets are reconstructed from Git and the built image. |
| Eviction | PDB minimum 1 | A voluntary eviction should retain a healthy serving pod. |
| Rollout | maxSurge 1; maxUnavailable 0 | Requires space for a third anti-affined pod before removing an old one. |

### How a failure is handled

The surviving NGINX pod serves new requests after endpoint detection/routing converges. No database promotion or volume restoration is required. The failed node does not contain the only copy of the site source or published image.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | One pod can continue serving. However, hard anti-affinity prevents the lost replica from simply joining the survivor on the same node; availability returns to full redundancy only when another eligible placement is available. |
| RTX worker only | The app has no dedicated RTX dependency, but its ordinary pods do not automatically tolerate the quorum taint. Spare capacity on a tainted node is not automatically usable surge capacity. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

With exactly two eligible nodes already occupied by the two old replicas, the surge pod cannot schedule and zero-unavailable prevents freeing a slot. This is a rollout deadlock condition, not evidence that steady-state node failover is broken.

### What prevents a stronger HA claim

Ingress, DNS, network, and API-driven endpoint updates remain shared dependencies. A mutable image tag does not provide rollback provenance or automatically trigger a rollout.

### What would improve the availability contract

For predictable updates, provide a third eligible failure domain or change the rollout to a placement-compatible strategy as a separate manifest change. Use immutable images and a real request test during one-node maintenance.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/docs/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/docs/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/docs/certificate.yaml)
- [`deployment.yaml`](https://github.com/antblu/antalos/blob/main/apps/docs/deployment.yaml)

## Continue

Read the [deployment guide](/admin-guide/docs/) for dependency order, initial credentials, and integration work. The [official documentation](https://starlight.astro.build/) explains the upstream product; the topology above describes this repository.
