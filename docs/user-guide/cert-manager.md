---
title: "cert-manager · Use"
description: "What cert-manager does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="cert-manager guide sections"><a aria-current="page" href="/user-guide/cert-manager/">Use</a><a href="/infrastructure/cert-manager/">Architecture</a><a href="/admin-guide/cert-manager/">Operate</a></nav>

cert-manager automates TLS certificate issuance and renewal. Application owners declare a Certificate and reference its generated TLS Secret from ingress. Antalos uses DNS-01 validation through Cloudflare and the `letsencrypt-prod` ClusterIssuer.

## Access and audience

This is a platform service with no standalone user-facing website. Its consumers use Kubernetes resources or internal endpoints.

## Your first workflow

1. Keep one `certificate.yaml` with each TLS-enabled service. List every DNS name served by that certificate.

2. Reference the generated Secret in the service’s ingress and keep the certificate in the namespace that consumes it.

3. Use certificate status and ACME challenge events to understand issuance. A browser receiving an old certificate may still be reaching the wrong ingress route.

## Get help

Report the service hostname, certificate error, and time. Do not bypass the warning or change device trust settings to hide an unexpected certificate problem.

## During an interruption

An interruption can affect the applications that depend on this platform service. Ask the administrator to identify the affected service and expected recovery path.

Administrators can read [the architecture and recovery limits](/infrastructure/cert-manager/#availability-and-failure-behavior).

## Official documentation

Use the [official cert-manager documentation](https://cert-manager.io/docs/) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/cert-manager/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/cert-manager/).
