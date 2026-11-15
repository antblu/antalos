---
title: "BentoPDF · Architecture"
description: "NGINX replicas, Authentik forward-auth, and in-browser PDF processing."
---

<nav class="guide-switcher" aria-label="BentoPDF guide sections"><a href="/user-guide/bentopdf/">Use</a><a aria-current="page" href="/infrastructure/bentopdf/">Architecture</a><a href="/admin-guide/bentopdf/">Operate</a></nav>

`bentopdf.yaml` deploys two stateless NGINX containers from the `bentopdf-simple` image. Required anti-affinity and a disruption budget retain one serving replica during ordinary maintenance. The ingress chains `traefik-authentik-forward-auth` with `bentopdf-headers`; the latter sets COOP and COEP for browser isolation. There is no application database or file-upload PVC in this service.

## Components

<figure class="architecture-diagram" aria-label="BentoPDF · component flow">
<div class="diagram-heading">BentoPDF · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Protected origin</span><ul><li>Browser → Traefik</li><li>Authentik forward-auth</li></ul></li><li class="diagram-stage"><span class="diagram-label">Static serving</span><ul><li>2 NGINX replicas</li><li>COOP / COEP response headers</li></ul></li><li class="diagram-stage"><span class="diagram-label">Client workspace</span><ul><li>WebAssembly processing</li><li>Local files → downloaded PDF</li></ul></li></ol>
</figure>

## Data and recovery

Git, the image, and ingress configuration reconstruct the server. User input and exported PDFs remain on the client. Downloaded results need the user’s own storage and backup policy.

## Availability and failure behavior

**HA static serving tier; access depends on the shared identity and ingress services.**

The expected behavior assumes healthy replicas with the intended placement and reachable dependencies. Verify it in a failure drill on your deployment.

### Component redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Frontend | 2 stateless pods on separate nodes | Ready Service endpoints serve interchangeable copies of frontend assets. |
| Update/eviction protection | Zero surge; one unavailable; PDB minimum 1 | Retains one serving replica during the intended rolling update or voluntary eviction. |
| PDF processing | Inside each user’s browser | No server database or shared processing volume to promote. |
| Access | Authentik forward-auth and Traefik | A separate dependency path must be reachable for protected access. |

### Failover and recovery

Once Kubernetes stops routing to the failed endpoint, fresh page and asset requests go to the other replica. A PDF operation already running in a loaded browser is not transferred between pods and may continue locally; subsequent asset fetches still need the site.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | The other serving replica can handle new requests. There is no persistent application volume attached to the lost node that must move before the static site returns. |
| RTX worker only | No app-specific voter or backend is pinned to RTX. Whole-host API failure can still affect endpoint updates and replacement scheduling. |
| A second failure before recovery | Check surviving endpoints and capacity before further maintenance. For replicated data or voting groups, check the remaining copies and quorum. |

Losing the RTX Proxmox host takes down both its worker and control-plane VMs, including the default external API endpoint. Factor that dependency into [whole-host failure testing](/infrastructure/availability/#physical-hosts-and-the-api-endpoint).

### Upgrades and voluntary maintenance

The declared zero-surge update fits two eligible nodes, provided the remaining pod is Ready. A PDB controls eviction; it does not prevent every failed release or node outage.

### Availability limits

This is not independent end-to-end HA while Authentik, ingress, DNS, and their dependencies can fail. Browser memory exhaustion and a missing optional CORS proxy are feature problems that extra server replicas do not fix.

### Improving availability

After losing one pod, load the protected page and run a PDF job. Check the Authentik and ingress paths if the page fails to load. Check the browser if the PDF job fails.

See [platform availability](/infrastructure/availability/) for shared dependencies and failure-test criteria.

## Configuration ownership

Keep Kubernetes resources in `apps/bentopdf/` and environment-specific inputs in `apps/variables.yaml`. Use the application’s backup procedure for any settings it stores in its database.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/bentopdf/app.yaml)
- [`bentopdf.yaml`](https://github.com/antblu/antalos/blob/main/apps/bentopdf/bentopdf.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/bentopdf/certificate.yaml)

## Related guides

- [deployment guide](/admin-guide/bentopdf/) for setup and recovery
- [official documentation](https://www.bentopdf.com/docs/) for product configuration
