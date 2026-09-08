---
title: "Authentik \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for Authentik in Antalos."
---

<nav class="guide-switcher" aria-label="Authentik guide sections"><a href="/user-guide/authentik/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/authentik/">Infrastructure Explanation</a><a href="/admin-guide/authentik/">Deployment and Admin Guide</a></nav>

The official chart runs two server replicas and two worker replicas with required pod anti-affinity. Servers handle browser and protocol requests; workers perform background tasks. Both use the two-instance `authentik-db` CloudNativePG cluster. `media-pvc.yaml` provides shared media from NFS. Traefik sends HTTPS to the server Service, while the embedded outpost supplies forward-auth decisions for protected ingresses.

## Component boundaries

<figure class="architecture-diagram" aria-label="Authentik · component flow">
<div class="diagram-heading">Authentik · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Identity requests</span><ul><li>Browser / OIDC / SAML</li><li>Traefik → Authentik Service</li></ul></li><li class="diagram-stage"><span class="diagram-label">Processing</span><ul><li>2 server replicas</li><li>2 worker replicas / embedded outpost</li></ul></li><li class="diagram-stage"><span class="diagram-label">Shared state</span><ul><li>PostgreSQL · 2 instances</li><li>NFS media / sealed application key</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Back up PostgreSQL, the media export, and the original `AUTHENTIK_SECRET_KEY`. The database holds users, provider definitions, policy bindings, and flows. Restoring pods from Git does not recreate provider configuration stored in that database.

## Availability and failure behavior

Partial availability: server, worker, and database replicas span nodes, but NFS remains external and the repository does not declare an Authentik application disruption budget. Identity outages can prevent new sessions in dependent applications.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/authentik/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/certificate.yaml)
- [`db-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/db-secret.yaml)
- [`db.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/db.yaml)
- [`email-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/email-secret.yaml)
- [`media-pvc.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/media-pvc.yaml)
- [`metrics.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/metrics.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/secrets.yaml)

## Continue

Read the [deployment guide](/admin-guide/authentik/) for dependency order, initial credentials, and integration work. The [official documentation](https://docs.goauthentik.io/) explains the upstream product; the topology above describes this repository.
