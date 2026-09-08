---
title: "BentoPDF \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for BentoPDF in Antalos."
---

<nav class="guide-switcher" aria-label="BentoPDF guide sections"><a href="/user-guide/bentopdf/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/bentopdf/">Infrastructure Explanation</a><a href="/admin-guide/bentopdf/">Deployment and Admin Guide</a></nav>

`bentopdf.yaml` deploys two stateless NGINX containers from the `bentopdf-simple` image. Required anti-affinity and a disruption budget retain one serving replica during ordinary maintenance. The ingress chains `traefik-authentik-forward-auth` with `bentopdf-headers`; the latter sets COOP and COEP for browser isolation. There is no application database or file-upload PVC in this service.

## Component boundaries

<figure class="architecture-diagram" aria-label="BentoPDF · component flow">
<div class="diagram-heading">BentoPDF · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Protected origin</span><ul><li>Browser → Traefik</li><li>Authentik forward-auth</li></ul></li><li class="diagram-stage"><span class="diagram-label">Static serving</span><ul><li>2 NGINX replicas</li><li>COOP / COEP response headers</li></ul></li><li class="diagram-stage"><span class="diagram-label">Client workspace</span><ul><li>WebAssembly processing</li><li>Local files → downloaded PDF</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Git, the image, and ingress configuration reconstruct the server. User input and exported PDFs remain on the client. Downloaded results need the user’s own storage and backup policy.

## Availability and failure behavior

**Availability classification: HA static serving tier; access depends on the shared identity and ingress services.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Frontend | 2 stateless pods on separate nodes | Ready Service endpoints serve interchangeable copies of frontend assets. |
| Update/eviction protection | Zero surge; one unavailable; PDB minimum 1 | Retains one serving replica during the intended rolling update or voluntary eviction. |
| PDF processing | Inside each user’s browser | No server database or shared processing volume to promote. |
| Access | Authentik forward-auth and Traefik | A separate dependency path must be reachable for protected access. |

### How a failure is handled

Once Kubernetes stops routing to the failed endpoint, fresh page and asset requests go to the other replica. A PDF operation already running in a loaded browser is not transferred between pods and may continue locally; subsequent asset fetches still need the site.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | The other serving replica can handle new requests. There is no persistent application volume attached to the lost node that must move before the static site returns. |
| RTX worker only | No app-specific voter or backend is pinned to RTX. Whole-host API failure can still affect endpoint updates and replacement scheduling. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

The declared zero-surge update fits two eligible nodes, provided the remaining pod is Ready. A PDB controls eviction; it does not prevent every failed release or node outage.

### What prevents a stronger HA claim

This is not independent end-to-end HA while Authentik, ingress, DNS, and their dependencies can fail. Browser memory exhaustion and a missing optional CORS proxy are feature problems that extra server replicas do not fix.

### What would improve the availability contract

Measure protected page access after losing one serving pod and separately assess identity/ingress continuity. Preserve an honest distinction between frontend uptime and browser job success.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/bentopdf/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/bentopdf/app.yaml)
- [`bentopdf.yaml`](https://github.com/antblu/antalos/blob/main/apps/bentopdf/bentopdf.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/bentopdf/certificate.yaml)

## Continue

Read the [deployment guide](/admin-guide/bentopdf/) for dependency order, initial credentials, and integration work. The [official documentation](https://www.bentopdf.com/docs/) explains the upstream product; the topology above describes this repository.
