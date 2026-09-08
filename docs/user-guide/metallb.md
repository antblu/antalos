---
title: "MetalLB \u00b7 Overview and User Guide"
description: "What MetalLB does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="MetalLB guide sections"><a aria-current="page" href="/user-guide/metallb/">Overview and User Guide</a><a href="/infrastructure/metallb/">Infrastructure Explanation</a><a href="/admin-guide/metallb/">Deployment and Admin Guide</a></nav>

MetalLB assigns and advertises LoadBalancer addresses on the local network. It supplies the entry addresses used by Traefik and direct protocol services. It does not create public DNS records, configure the upstream router, or make a private address reachable from the Internet.

## Access and audience

This is a platform service with no standalone user-facing website. Its consumers use Kubernetes resources or internal endpoints.

## Your first workflow

1. Choose an unused address from `METALLB_ADDRESS_POOL` when a service needs a stable LoadBalancer IP. Keep that choice in `apps/variables.yaml`.

2. Declare the Service and its intended TCP/UDP ports. Use sharing annotations only when the services meet MetalLB’s sharing requirements.

3. Inspect Service events and the assigned address before troubleshooting the application above it.

## When you need an administrator

An unassigned address points to pool/allocation problems. An assigned but unreachable address points to advertisement, traffic policy, endpoint health, or network routing. Start with Service events and speaker logs.

## Official documentation

Use the [official MetalLB documentation](https://metallb.io/usage/) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/metallb/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/metallb/).
