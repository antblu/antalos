---
title: "MetalLB · Use"
description: "What MetalLB does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="MetalLB guide sections"><a aria-current="page" href="/user-guide/metallb/">Use</a><a href="/infrastructure/metallb/">Architecture</a><a href="/admin-guide/metallb/">Operate</a></nav>

MetalLB assigns and advertises LoadBalancer addresses on the local network. It supplies the entry addresses used by Traefik and direct protocol services. It does not create public DNS records, configure the upstream router, or make a private address reachable from the Internet.

## Access and audience

This is a platform service with no standalone user-facing website. Its consumers use Kubernetes resources or internal endpoints.

## Your first workflow

1. Choose an unused address from `METALLB_ADDRESS_POOL` when a service needs a stable LoadBalancer IP. Keep that choice in `apps/variables.yaml`.

2. Declare the Service and its intended TCP/UDP ports. Use sharing annotations only when the services meet MetalLB’s sharing requirements.

3. Inspect Service events and the assigned address before troubleshooting the application above it.

## Get help

Report the unreachable service and whether it fails from one network or all networks. Users do not need to select or modify load-balancer addresses.

## During an interruption

An interruption can affect the applications that depend on this platform service. Ask the administrator to identify the affected service and expected recovery path.

Administrators can read [the architecture and recovery limits](/infrastructure/metallb/#availability-and-failure-behavior).

## Official documentation

Use the [official MetalLB documentation](https://metallb.io/usage/) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/metallb/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/metallb/).
