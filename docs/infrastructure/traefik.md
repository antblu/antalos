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

**Availability classification: HA ingress process tier for one serving-node loss; upstream routing and established connections remain separate.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Proxy | 2 anti-affined replicas | Both watch Kubernetes and route configured HTTP/TCP/UDP traffic. |
| Exposure | MetalLB LoadBalancer | The advertised address reaches ready backend proxy endpoints. |
| Update/eviction | Zero surge; one unavailable; PDB minimum 1 | Fits two eligible serving nodes for the intended update. |
| TLS/auth | Certificate Secrets and Authentik middleware | Existing certificates are reusable; identity decisions depend on Authentik. |

### How a failure is handled

The surviving proxy can accept new connections after MetalLB and Kubernetes routing converge. Existing TCP, WebSocket, and UDP session handling is not transferred from the failed process. Native protocols and application clients must reconnect or recover according to their own rules.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | A ready proxy remains on the other worker; endpoint/advertisement detection and surviving throughput set the interruption. The real backend must also survive the same failure. |
| RTX worker only | Worker-only loss need not remove a serving proxy, but the elected MetalLB speaker can be affected. Host loss also affects the API endpoint and route/control-plane updates. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

The declared rolling strategy retains a serving instance and does not require a third anti-affined placement. Client connections on a terminating instance still need graceful completion or reconnect.

### What prevents a stronger HA claim

A single router/switch/DNS failure can remove access to both proxies. Two Traefik pods do not make a singleton backend or an Authentik-protected access path independent of those dependencies.

### What would improve the availability contract

Exercise HTTP, TCP, UDP, and WSS separately, document router/DNS availability, and measure client reconnection rather than equating a surviving proxy with uninterrupted sessions.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/traefik/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/traefik/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/traefik/certificate.yaml)
- [`forward-auth.yaml`](https://github.com/antblu/antalos/blob/main/apps/traefik/forward-auth.yaml)
- [`metrics.yaml`](https://github.com/antblu/antalos/blob/main/apps/traefik/metrics.yaml)
- [`rustdesk-udp.yaml`](https://github.com/antblu/antalos/blob/main/apps/traefik/rustdesk-udp.yaml)

## Continue

Read the [deployment guide](/admin-guide/traefik/) for dependency order, initial credentials, and integration work. The [official documentation](https://doc.traefik.io/traefik/) explains the upstream product; the topology above describes this repository.
