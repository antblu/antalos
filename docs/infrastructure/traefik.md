---
title: "Traefik \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for Traefik in Antalos."
---

<nav class="guide-switcher" aria-label="Traefik guide sections"><a href="/user-guide/traefik/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/traefik/">Infrastructure Explanation</a><a href="/admin-guide/traefik/">Deployment and Admin Guide</a></nav>

Two anti-affined Traefik replicas sit behind a MetalLB LoadBalancer. cert-manager supplies TLS Secrets. Forward-auth calls the Authentik server’s embedded outpost. RustDesk uses additional native entry points and a separate UDP Service for its shared numeric TCP/UDP port.

## Component boundaries

<figure class="architecture-diagram" aria-label="Traefik · component flow">
<div class="diagram-heading">Traefik · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Traffic</span><ul><li>DNS → MetalLB address</li><li>HTTP / TCP / UDP entry points</li></ul></li><li class="diagram-stage"><span class="diagram-label">Route</span><ul><li>2 Traefik replicas</li><li>Host/path / middleware / TLS</li></ul></li><li class="diagram-stage"><span class="diagram-label">Backends</span><ul><li>Ready application endpoints</li><li>Authentik for protected HTTP routes</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Routes, middleware, entry points, and certificates are declarative. Preserve authentication-provider configuration and DNS/router state alongside Git. Traefik does not persist application sessions or files.

## Availability and failure behavior

The ingress serving tier is replicated with a rolling strategy and disruption budget. MetalLB advertisement, DNS, the router, certificate validity, and backend health remain dependencies. Active connections may reset during failure.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/traefik/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/traefik/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/traefik/certificate.yaml)
- [`forward-auth.yaml`](https://github.com/antblu/antalos/blob/main/apps/traefik/forward-auth.yaml)
- [`metrics.yaml`](https://github.com/antblu/antalos/blob/main/apps/traefik/metrics.yaml)
- [`rustdesk-udp.yaml`](https://github.com/antblu/antalos/blob/main/apps/traefik/rustdesk-udp.yaml)

## Continue

Read the [deployment guide](/admin-guide/traefik/) for dependency order, initial credentials, and integration work. The [official documentation](https://doc.traefik.io/traefik/) explains the upstream product; the topology above describes this repository.
