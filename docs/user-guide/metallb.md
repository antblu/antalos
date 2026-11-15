---
title: "MetalLB · Use"
description: "Choose a LoadBalancer address and check its advertisement from the LAN."
---

<nav class="guide-switcher" aria-label="MetalLB guide sections"><a aria-current="page" href="/user-guide/metallb/">Use</a><a href="/infrastructure/metallb/">Architecture</a><a href="/admin-guide/metallb/">Operate</a></nav>

MetalLB assigns and advertises LoadBalancer addresses on the local network. It supplies the entry addresses used by Traefik and direct protocol services. It does not create public DNS records, configure the upstream router, or make a private address reachable from the Internet.

## Access

Use Kubernetes resources or internal endpoints to work with this service.

## Assign a LoadBalancer address

1. Choose an unused address from `METALLB_ADDRESS_POOL` when a service needs a stable LoadBalancer IP. Keep that choice in `apps/variables.yaml`.

2. Declare the Service and its intended TCP/UDP ports. Use sharing annotations only when the services meet MetalLB’s sharing requirements.

3. Inspect Service events and the assigned address before troubleshooting the application above it.

## Get help

Report the unreachable service and whether it fails from one network or all networks. Users do not need to select or modify load-balancer addresses.

## During an interruption

If a LoadBalancer address stops responding, ask the administrator to check the Service endpoints and its LAN advertisement.

See [expected failure behavior and recovery](/infrastructure/metallb/#availability-and-failure-behavior).

## Official documentation

Use the [official MetalLB documentation](https://metallb.io/usage/) for your installed version. Ask your administrator which optional features are enabled.

See the [architecture](/infrastructure/metallb/) or [deployment guide](/admin-guide/metallb/).
