---
title: "cert-manager \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for cert-manager in Antalos."
---

<nav class="guide-switcher" aria-label="cert-manager guide sections"><a href="/user-guide/cert-manager/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/cert-manager/">Infrastructure Explanation</a><a href="/admin-guide/cert-manager/">Deployment and Admin Guide</a></nav>

The Helm chart installs certificate controllers, admission webhook, and CA injection. The webhook is explicitly replicated; the other controller replica counts are not increased here. `issuer.yaml` defines staging and production ACME issuers that reference `cloudflare-api-token/api-token`.

## Component boundaries

<figure class="architecture-diagram" aria-label="cert-manager · component flow">
<div class="diagram-heading">cert-manager · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Declare</span><ul><li>Certificate in service namespace</li><li>ClusterIssuer / DNS token</li></ul></li><li class="diagram-stage"><span class="diagram-label">Issue / renew</span><ul><li>Controllers / admission webhook</li><li>DNS-01 → Cloudflare / ACME</li></ul></li><li class="diagram-stage"><span class="diagram-label">Serve TLS</span><ul><li>Generated TLS Secret</li><li>Traefik reads the Secret</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Keep DNS API access recoverable and preserve the sealing keys for its Secret. Issued TLS Secrets and ACME account keys are runtime state. Reissuance also depends on DNS control and ACME availability.

## Availability and failure behavior

Partial availability: issued certificates remain usable by ingress while controllers are down. New issuance and renewal can pause, so expiry monitoring is separate from web readiness.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/cert-manager/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/cert-manager/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/cert-manager/certificate.yaml)
- [`issuer.yaml`](https://github.com/antblu/antalos/blob/main/apps/cert-manager/issuer.yaml)

## Continue

Read the [deployment guide](/admin-guide/cert-manager/) for dependency order, initial credentials, and integration work. The [official documentation](https://cert-manager.io/docs/) explains the upstream product; the topology above describes this repository.
