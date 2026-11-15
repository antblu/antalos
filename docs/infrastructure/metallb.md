---
title: "MetalLB · Architecture"
description: "MetalLB address allocation, speakers, and the upstream network path."
---

<nav class="guide-switcher" aria-label="MetalLB guide sections"><a href="/user-guide/metallb/">Use</a><a aria-current="page" href="/infrastructure/metallb/">Architecture</a><a href="/admin-guide/metallb/">Operate</a></nav>

The chart supplies a controller for allocation and node-level speakers for advertisement. `config/pools.yaml` defines the address pool and L2 advertisement. In L2 mode an elected node advertises a service address and Kubernetes routes traffic to eligible endpoints.

## Components

<figure class="architecture-diagram" aria-label="MetalLB · component flow">
<div class="diagram-heading">MetalLB · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Allocate</span><ul><li>LoadBalancer Service</li><li>Configured IPAddressPool</li></ul></li><li class="diagram-stage"><span class="diagram-label">Advertise</span><ul><li>Controller allocates IP</li><li>L2 speaker elects advertiser</li></ul></li><li class="diagram-stage"><span class="diagram-label">Route</span><ul><li>LAN → service address</li><li>Kubernetes → ready endpoints</li></ul></li></ol>
</figure>

## Data and recovery

Address pools and Service declarations live in Git. Reserve the same range outside DHCP and other infrastructure allocation systems. Network configuration outside Kubernetes must be retained separately.

## Availability and failure behavior

**Partially HA: distributed address advertisement; controller allocation and the physical network remain separate.**

The expected behavior assumes healthy replicas with the intended placement and reachable dependencies. Verify it in a failure drill on your deployment.

### Component redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Speakers | Node-level instances | An eligible speaker can take over L2 advertisement of an address. |
| Controller | No explicit replica increase | Address allocation/config changes can wait for controller recovery. |
| Data forwarding | Kubernetes Services and endpoints | A new advertiser still needs reachable healthy service endpoints. |

### Failover and recovery

In the configured L2 mode, the eligible speaker set selects an advertiser. After its loss, another can advertise the same service IP and clients/neighbors must update their network state. MetalLB does not copy an application session or route around a dead physical subnet.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | The address may move if its advertiser was on that worker. Ready endpoints on remaining nodes are still needed; Local versus Cluster traffic policy also affects eligible forwarding. |
| RTX worker only | May remove a speaker; no data replica lives in the pool object. Loss of the whole host can additionally interrupt API-driven configuration. |
| A second failure before recovery | Check surviving endpoints and capacity before further maintenance. For replicated data or voting groups, check the remaining copies and quorum. |

Losing the RTX Proxmox host takes down both its worker and control-plane VMs, including the default external API endpoint. Factor that dependency into [whole-host failure testing](/infrastructure/availability/#physical-hosts-and-the-api-endpoint).

### Upgrades and voluntary maintenance

Existing allocations and advertisement have a different dependency path from assigning new IPs. A controller restart should not be described as proof that all existing traffic stops or all new allocations continue.

### Availability limits

L2 failover can have convergence delay. The single external router, address conflict, VLAN, or switch can defeat all speakers. The chart’s controller count is not explicitly overridden.

### Improving availability

Document the external network failure domains, make control-component redundancy explicit if required, and measure reachability from actual LAN/WAN clients after advertiser loss.

See [platform availability](/infrastructure/availability/) for shared dependencies and failure-test criteria.

## Configuration ownership

Keep Kubernetes resources in `apps/metallb/` and environment-specific inputs in `apps/variables.yaml`. Use the application’s backup procedure for any settings it stores in its database.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/metallb/app.yaml)

## Related guides

- [deployment guide](/admin-guide/metallb/) for setup and recovery
- [official documentation](https://metallb.io/usage/) for product configuration
