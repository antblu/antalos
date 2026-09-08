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

**Availability classification: Partially HA: replicated admission webhook; certificate issuance is not fully replicated by the manifest.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Webhook | 2 anti-affined replicas | Admission can use a remaining endpoint when one webhook pod fails. |
| Controller / CA injector | No explicit replica increase | Issuance/reconciliation can pause during their recovery. |
| Already issued certificate | Kubernetes TLS Secret read by ingress | Existing HTTPS can continue without an immediate call to cert-manager. |
| Issuance dependencies | Cloudflare DNS / ACME / API | These external/control-plane services must work for new certificates and renewals. |

### How a failure is handled

Webhook service routing can retain admission availability. Existing Traefik TLS termination continues using its loaded/available Secret while an issuer controller restarts. The failure becomes user-visible when a needed certificate cannot be issued, loaded, or renewed before expiry.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | Issued sites may remain reachable while new certificate operations pause. Distinguish certificate-controller health from the active certificate served by ingress. |
| RTX worker only | No dedicated voter; whole-host API failure interrupts certificate reconciliation independently of webhook replica count. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

Webhook updates use zero surge/one unavailable. Other controller behavior is chart-derived; do not infer identical rollout guarantees from the webhook overrides.

### What prevents a stronger HA claim

Two admission replicas are not two independent certificate-issuance stacks. Missing DNS credentials, ACME unavailability, and the current source-rendering prerequisite can block issuance even with healthy pods.

### What would improve the availability contract

Set and document controller/webhook availability policies where needed, monitor renewal deadlines, and keep DNS access recoverable. Test renewal separately from continued serving of an already-issued certificate.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/cert-manager/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/cert-manager/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/cert-manager/certificate.yaml)
- [`issuer.yaml`](https://github.com/antblu/antalos/blob/main/apps/cert-manager/issuer.yaml)

## Continue

Read the [deployment guide](/admin-guide/cert-manager/) for dependency order, initial credentials, and integration work. The [official documentation](https://cert-manager.io/docs/) explains the upstream product; the topology above describes this repository.
