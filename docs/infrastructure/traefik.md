---
title: "Traefik · Architecture"
description: "Traefik entrypoints, middleware, TLS, and service routing."
---

<nav class="guide-switcher" aria-label="Traefik guide sections"><a href="/user-guide/traefik/">Use</a><a aria-current="page" href="/infrastructure/traefik/">Architecture</a><a href="/admin-guide/traefik/">Operate</a></nav>

Two anti-affined Traefik replicas sit behind a MetalLB LoadBalancer. cert-manager supplies TLS Secrets. Forward-auth calls the Authentik server’s embedded outpost. RustDesk uses additional native entry points and a separate UDP Service for its shared numeric TCP/UDP port.

## Components

<figure class="architecture-diagram" aria-label="Traefik · component flow">
<div class="diagram-heading">Traefik · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Traffic</span><ul><li>DNS → MetalLB address</li><li>HTTP / TCP / UDP entry points</li></ul></li><li class="diagram-stage"><span class="diagram-label">Route</span><ul><li>2 Traefik replicas</li><li>Host/path / middleware / TLS</li></ul></li><li class="diagram-stage"><span class="diagram-label">Backends</span><ul><li>Ready application endpoints</li><li>Authentik for protected HTTP routes</li></ul></li></ol>
</figure>

## Data and recovery

Routes, middleware, entry points, and certificates are declarative. Preserve authentication-provider configuration and DNS/router state alongside Git. Traefik does not persist application sessions or files.

## Availability and failure behavior

**HA ingress process tier for one serving-node loss; upstream routing and established connections remain separate.**

The expected behavior assumes healthy replicas with the intended placement and reachable dependencies. Verify it in a failure drill on your deployment.

### Component redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Proxy | 2 anti-affined replicas | Both watch Kubernetes and route configured HTTP/TCP/UDP traffic. |
| Exposure | MetalLB LoadBalancer | The advertised address reaches ready backend proxy endpoints. |
| Update/eviction | Zero surge; one unavailable; PDB minimum 1 | Fits two eligible serving nodes for the intended update. |
| TLS/auth | Certificate Secrets and Authentik middleware | Existing certificates are reusable; identity decisions depend on Authentik. |

### Failover and recovery

The surviving proxy can accept new connections after MetalLB and Kubernetes routing converge. Existing TCP, WebSocket, and UDP session handling is not transferred from the failed process. Native protocols and application clients must reconnect or recover according to their own rules.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | A ready proxy remains on the other worker; endpoint/advertisement detection and surviving throughput set the interruption. The real backend must also survive the same failure. |
| RTX worker only | Worker-only loss need not remove a serving proxy, but the elected MetalLB speaker can be affected. Host loss also affects the API endpoint and route/control-plane updates. |
| A second failure before recovery | Check surviving endpoints and capacity before further maintenance. For replicated data or voting groups, check the remaining copies and quorum. |

Losing the RTX Proxmox host takes down both its worker and control-plane VMs, including the default external API endpoint. Factor that dependency into [whole-host failure testing](/infrastructure/availability/#physical-hosts-and-the-api-endpoint).

### Upgrades and voluntary maintenance

The declared rolling strategy retains a serving instance and does not require a third anti-affined placement. Client connections on a terminating instance still need graceful completion or reconnect.

### Availability limits

A single router/switch/DNS failure can remove access to both proxies. Two Traefik pods do not make a singleton backend or an Authentik-protected access path independent of those dependencies.

### Improving availability

Exercise HTTP, TCP, UDP, and WSS separately, document router/DNS availability, and measure client reconnection rather than equating a surviving proxy with uninterrupted sessions.

See [platform availability](/infrastructure/availability/) for shared dependencies and failure-test criteria.

## Configuration ownership

Keep Kubernetes resources in `apps/traefik/` and environment-specific inputs in `apps/variables.yaml`. Use the application’s backup procedure for any settings it stores in its database.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/traefik/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/traefik/certificate.yaml)
- [`forward-auth.yaml`](https://github.com/antblu/antalos/blob/main/apps/traefik/forward-auth.yaml)
- [`metrics.yaml`](https://github.com/antblu/antalos/blob/main/apps/traefik/metrics.yaml)
- [`rustdesk-udp.yaml`](https://github.com/antblu/antalos/blob/main/apps/traefik/rustdesk-udp.yaml)

## Related guides

- [deployment guide](/admin-guide/traefik/) for setup and recovery
- [official documentation](https://doc.traefik.io/traefik/) for product configuration
