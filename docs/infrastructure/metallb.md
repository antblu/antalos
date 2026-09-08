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

**Availability classification: Partially HA: distributed address advertisement; controller allocation and the physical network remain separate.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Speakers | Node-level instances | An eligible speaker can take over L2 advertisement of an address. |
| Controller | No explicit replica increase | Address allocation/config changes can wait for controller recovery. |
| Data forwarding | Kubernetes Services and endpoints | A new advertiser still needs reachable healthy service endpoints. |

### How a failure is handled

In the configured L2 mode, the eligible speaker set selects an advertiser. After its loss, another can advertise the same service IP and clients/neighbors must update their network state. MetalLB does not copy an application session or route around a dead physical subnet.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | The address may move if its advertiser was on that worker. Ready endpoints on remaining nodes are still needed; Local versus Cluster traffic policy also affects eligible forwarding. |
| RTX worker only | May remove a speaker; no data replica lives in the pool object. Loss of the whole host can additionally interrupt API-driven configuration. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

Existing allocations and advertisement have a different dependency path from assigning new IPs. A controller restart should not be described as proof that all existing traffic stops or all new allocations continue.

### What prevents a stronger HA claim

L2 failover can have convergence delay. The single external router, address conflict, VLAN, or switch can defeat all speakers. The chart’s controller count is not explicitly overridden.

### What would improve the availability contract

Document the external network failure domains, make control-component redundancy explicit if required, and measure reachability from actual LAN/WAN clients after advertiser loss.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/metallb/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/metallb/app.yaml)

## Continue

Read the [deployment guide](/admin-guide/metallb/) for dependency order, initial credentials, and integration work. The [official documentation](https://metallb.io/usage/) explains the upstream product; the topology above describes this repository.
