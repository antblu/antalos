---
title: "MetalLB \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for MetalLB in Antalos."
---

<nav class="guide-switcher" aria-label="MetalLB guide sections"><a href="/user-guide/metallb/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/metallb/">Infrastructure Explanation</a><a href="/admin-guide/metallb/">Deployment and Admin Guide</a></nav>

The chart supplies a controller for allocation and node-level speakers for advertisement. `config/pools.yaml` defines the address pool and L2 advertisement. In L2 mode an elected node advertises a service address and Kubernetes routes traffic to eligible endpoints.

## Component boundaries

<figure class="architecture-diagram" aria-label="MetalLB · component flow">
<div class="diagram-heading">MetalLB · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Allocate</span><ul><li>LoadBalancer Service</li><li>Configured IPAddressPool</li></ul></li><li class="diagram-stage"><span class="diagram-label">Advertise</span><ul><li>Controller allocates IP</li><li>L2 speaker elects advertiser</li></ul></li><li class="diagram-stage"><span class="diagram-label">Route</span><ul><li>LAN → service address</li><li>Kubernetes → ready endpoints</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Address pools and Service declarations live in Git. Reserve the same range outside DHCP and other infrastructure allocation systems. Network configuration outside Kubernetes must be retained separately.

## Availability and failure behavior

L2 advertisement can move after a speaker/node failure. The controller is not explicitly replicated, so allocation changes may pause. Router, switch, and shared subnet failures remain outside the replica model.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/metallb/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/metallb/app.yaml)

## Continue

Read the [deployment guide](/admin-guide/metallb/) for dependency order, initial credentials, and integration work. The [official documentation](https://metallb.io/usage/) explains the upstream product; the topology above describes this repository.
