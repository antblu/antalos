---
title: "cert-manager \u00b7 Overview and User Guide"
description: "What cert-manager does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="cert-manager guide sections"><a aria-current="page" href="/user-guide/cert-manager/">Overview and User Guide</a><a href="/infrastructure/cert-manager/">Infrastructure Explanation</a><a href="/admin-guide/cert-manager/">Deployment and Admin Guide</a></nav>

cert-manager automates TLS certificate issuance and renewal. Application owners declare a Certificate and reference its generated TLS Secret from ingress. Antalos uses DNS-01 validation through Cloudflare and the `letsencrypt-prod` ClusterIssuer.

## Access and audience

This is a platform service with no standalone user-facing website. Its consumers use Kubernetes resources or internal endpoints.

## Your first workflow

1. Keep one `certificate.yaml` with each TLS-enabled service. List every DNS name served by that certificate.

2. Reference the generated Secret in the service’s ingress and keep the certificate in the namespace that consumes it.

3. Use certificate status and ACME challenge events to understand issuance. A browser receiving an old certificate may still be reaching the wrong ingress route.

## When you need an administrator

Inspect Certificate, CertificateRequest, Order, and Challenge in that order. An IssuerNotFound error is a resource name/kind problem; a DNS challenge failure requires inspecting token permissions and DNS propagation.

## Official documentation

Use the [official cert-manager documentation](https://cert-manager.io/docs/) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/cert-manager/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/cert-manager/).
