---
title: "Rancher \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for Rancher in Antalos."
---

<nav class="guide-switcher" aria-label="Rancher guide sections"><a href="/user-guide/rancher/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/rancher/">Infrastructure Explanation</a><a href="/admin-guide/rancher/">Deployment and Admin Guide</a></nav>

The Rancher Helm release runs two replicas with required host anti-affinity in `cattle-system`. A second Argo CD Application, `rancher-config`, supplies the TLS certificate from the same service directory. Traefik terminates HTTPS using `rancher-tls`. Rancher depends on the Kubernetes API of this same cluster.

## Component boundaries

<figure class="architecture-diagram" aria-label="Rancher · component flow">
<div class="diagram-heading">Rancher · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Operators</span><ul><li>Browser / application login</li><li>Traefik / rancher-tls</li></ul></li><li class="diagram-stage"><span class="diagram-label">Management UI</span><ul><li>2 Rancher replicas</li><li>cattle-system namespace</li></ul></li><li class="diagram-stage"><span class="diagram-label">Managed state</span><ul><li>Kubernetes API / agents</li><li>Same cluster’s resources</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Rancher management state lives in Kubernetes resources and secrets; recovery must account for that state as well as the Helm values. Preserve the platform recovery set and use upstream Rancher backup procedures where configured.

## Availability and failure behavior

**Availability classification: HA management web tier; it is not an independent control plane for recovering this cluster.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Rancher server | 2 replicas with required host anti-affinity | The ingress Service routes to the remaining server. |
| Managed state | Kubernetes API and cluster agents | UI replicas depend on the same cluster they manage. |
| Certificate | Separate rancher-config Application | Existing TLS Secret supports serving; certificate management has its own availability. |

### How a failure is handled

A failed Rancher pod can be removed from routing while another handles management requests. Active UI/API connections may reconnect. The healthy pod still needs Kubernetes API access and functioning agents; replacing a web server cannot recover an unavailable underlying API.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | A surviving server can remain accessible, assuming ingress and the API work. No second copy of a Rancher pod is a substitute for the etcd data and credentials underneath its resources. |
| RTX worker only | Worker-only failure has no dedicated Rancher voter impact. Losing the whole RTX host also removes the configured API address and can leave the web page reachable while cluster management fails. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

The repository pins two replicas and required anti-affinity but does not explicitly declare a Rancher PDB or rollout strategy. Those details are chart-derived; do not claim the standard zero-surge/minimum-one contract from this Application alone.

### What prevents a stronger HA claim

Rancher availability is bounded by ingress and the cluster API. Its local-cluster deployment cannot be your sole out-of-band recovery tool.

### What would improve the availability contract

Retain independent kubectl/Talos access, make chart-derived rollout/disruption settings explicit where needed, and measure both UI access and a real API-backed operation during one-server failure.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/rancher/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/rancher/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/rancher/certificate.yaml)

## Continue

Read the [deployment guide](/admin-guide/rancher/) for dependency order, initial credentials, and integration work. The [official documentation](https://ranchermanager.docs.rancher.com/) explains the upstream product; the topology above describes this repository.
