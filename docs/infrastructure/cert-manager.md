---
title: "cert-manager · Architecture"
description: "Certificate controllers, admission, DNS-01 validation, and TLS Secrets."
---

<nav class="guide-switcher" aria-label="cert-manager guide sections"><a href="/user-guide/cert-manager/">Use</a><a aria-current="page" href="/infrastructure/cert-manager/">Architecture</a><a href="/admin-guide/cert-manager/">Operate</a></nav>

The Helm chart installs certificate controllers, admission webhook, and CA injection. The webhook is explicitly replicated; the other controller replica counts are not increased here. `issuer.yaml` defines staging and production ACME issuers that reference `cloudflare-api-token/api-token`.

## Components

<figure class="architecture-diagram" aria-label="cert-manager · component flow">
<div class="diagram-heading">cert-manager · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Declare</span><ul><li>Certificate in service namespace</li><li>ClusterIssuer / DNS token</li></ul></li><li class="diagram-stage"><span class="diagram-label">Issue / renew</span><ul><li>Controllers / admission webhook</li><li>DNS-01 → Cloudflare / ACME</li></ul></li><li class="diagram-stage"><span class="diagram-label">Serve TLS</span><ul><li>Generated TLS Secret</li><li>Traefik reads the Secret</li></ul></li></ol>
</figure>

## Data and recovery

Keep DNS API access recoverable and preserve the sealing keys for its Secret. Issued TLS Secrets and ACME account keys are runtime state. Reissuance also depends on DNS control and ACME availability.

## Availability and failure behavior

**Partially HA: replicated admission webhook; certificate issuance is not fully replicated by the manifest.**

The expected behavior assumes healthy replicas with the intended placement and reachable dependencies. Verify it in a failure drill on your deployment.

### Component redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Webhook | 2 anti-affined replicas | Admission can use a remaining endpoint when one webhook pod fails. |
| Controller / CA injector | No explicit replica increase | Issuance/reconciliation can pause during their recovery. |
| Already issued certificate | Kubernetes TLS Secret read by ingress | Existing HTTPS can continue without an immediate call to cert-manager. |
| Issuance dependencies | Cloudflare DNS / ACME / API | These external/control-plane services must work for new certificates and renewals. |

### Failover and recovery

Webhook service routing can retain admission availability. Existing Traefik TLS termination continues using its loaded/available Secret while an issuer controller restarts. The failure becomes user-visible when a needed certificate cannot be issued, loaded, or renewed before expiry.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | Issued sites may remain reachable while new certificate operations pause. Distinguish certificate-controller health from the active certificate served by ingress. |
| RTX worker only | No dedicated voter; whole-host API failure interrupts certificate reconciliation independently of webhook replica count. |
| A second failure before recovery | Check surviving endpoints and capacity before further maintenance. For replicated data or voting groups, check the remaining copies and quorum. |

Losing the RTX Proxmox host takes down both its worker and control-plane VMs, including the default external API endpoint. Factor that dependency into [whole-host failure testing](/infrastructure/availability/#physical-hosts-and-the-api-endpoint).

### Upgrades and voluntary maintenance

Webhook updates use zero surge/one unavailable. Other controller behavior is chart-derived; do not infer identical rollout guarantees from the webhook overrides.

### Availability limits

Two admission replicas are not two independent certificate-issuance stacks. Missing DNS credentials, ACME unavailability, and the current source-rendering prerequisite can block issuance even with healthy pods.

### Improving availability

Set and document controller/webhook availability policies where needed, monitor renewal deadlines, and keep DNS access recoverable. Test renewal separately from continued serving of an already-issued certificate.

See [platform availability](/infrastructure/availability/) for shared dependencies and failure-test criteria.

## Configuration ownership

Keep Kubernetes resources in `apps/cert-manager/` and environment-specific inputs in `apps/variables.yaml`. Use the application’s backup procedure for any settings it stores in its database.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/cert-manager/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/cert-manager/certificate.yaml)
- [`issuer.yaml`](https://github.com/antblu/antalos/blob/main/apps/cert-manager/issuer.yaml)

## Related guides

- [deployment guide](/admin-guide/cert-manager/) for setup and recovery
- [official documentation](https://cert-manager.io/docs/) for product configuration
