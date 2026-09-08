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

The static serving tier is replicated. New access still depends on ingress and Authentik; losing a web replica does not transfer or restart an operation already running inside the browser.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/bentopdf/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/bentopdf/app.yaml)
- [`bentopdf.yaml`](https://github.com/antblu/antalos/blob/main/apps/bentopdf/bentopdf.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/bentopdf/certificate.yaml)

## Continue

Read the [deployment guide](/admin-guide/bentopdf/) for dependency order, initial credentials, and integration work. The [official documentation](https://www.bentopdf.com/docs/) explains the upstream product; the topology above describes this repository.
