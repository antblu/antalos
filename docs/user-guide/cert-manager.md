---
title: "cert-manager · Use"
description: "Declare certificates and check DNS-01 issuance in Kubernetes."
---

<nav class="guide-switcher" aria-label="cert-manager guide sections"><a aria-current="page" href="/user-guide/cert-manager/">Use</a><a href="/infrastructure/cert-manager/">Architecture</a><a href="/admin-guide/cert-manager/">Operate</a></nav>

cert-manager automates TLS certificate issuance and renewal. Application owners declare a Certificate and reference its generated TLS Secret from ingress. antalos uses DNS-01 validation through Cloudflare and the `letsencrypt-prod` ClusterIssuer.

## Access

Use Kubernetes resources or internal endpoints to work with this service.

## Request a TLS certificate

1. Keep one `certificate.yaml` with each TLS-enabled service. List every DNS name served by that certificate.

2. Reference the generated Secret in the service’s ingress and keep the certificate in the namespace that consumes it.

3. Use certificate status and ACME challenge events to understand issuance. A browser receiving an old certificate may still be reaching the wrong ingress route.

## Get help

Report the service hostname, certificate error, and time. Do not bypass the warning or change device trust settings to hide an unexpected certificate problem.

## During an interruption

If issuance pauses, ask the administrator to check the certificate status and expiry. Traefik can still serve a certificate it has loaded.

See [expected failure behavior and recovery](/infrastructure/cert-manager/#availability-and-failure-behavior).

## Official documentation

Use the [official cert-manager documentation](https://cert-manager.io/docs/) for your installed version. Ask your administrator which optional features are enabled.

See the [architecture](/infrastructure/cert-manager/) or [deployment guide](/admin-guide/cert-manager/).
