---
title: "Rancher · Architecture"
description: "Rancher management replicas and their Kubernetes API dependency."
---

<nav class="guide-switcher" aria-label="Rancher guide sections"><a href="/user-guide/rancher/">Use</a><a aria-current="page" href="/infrastructure/rancher/">Architecture</a><a href="/admin-guide/rancher/">Operate</a></nav>

The Rancher Helm release runs two replicas with required host anti-affinity in `cattle-system`. A second Argo CD Application, `rancher-config`, supplies the TLS certificate from the same service directory. Traefik terminates HTTPS using `rancher-tls`. Rancher depends on the Kubernetes API of this same cluster.

## Components

<figure class="architecture-diagram" aria-label="Rancher · component flow">
<div class="diagram-heading">Rancher · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Operators</span><ul><li>Browser / application login</li><li>Traefik / rancher-tls</li></ul></li><li class="diagram-stage"><span class="diagram-label">Management UI</span><ul><li>2 Rancher replicas</li><li>cattle-system namespace</li></ul></li><li class="diagram-stage"><span class="diagram-label">Managed state</span><ul><li>Kubernetes API / agents</li><li>Same cluster’s resources</li></ul></li></ol>
</figure>

## Data and recovery

Rancher management state lives in Kubernetes resources and secrets; recovery must account for that state as well as the Helm values. Preserve the platform recovery set and use upstream Rancher backup procedures where configured.

## Availability and failure behavior

**HA management web tier; it is not an independent control plane for recovering this cluster.**

The expected behavior assumes healthy replicas with the intended placement and reachable dependencies. Verify it in a failure drill on your deployment.

### Component redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Rancher server | 2 replicas with required host anti-affinity | The ingress Service routes to the remaining server. |
| Managed state | Kubernetes API and cluster agents | UI replicas depend on the same cluster they manage. |
| Certificate | Separate rancher-config Application | Existing TLS Secret supports serving; certificate management has its own availability. |

### Failover and recovery

A failed Rancher pod can be removed from routing while another handles management requests. Active UI/API connections may reconnect. The healthy pod still needs Kubernetes API access and functioning agents; replacing a web server cannot recover an unavailable underlying API.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | A surviving server can remain accessible, assuming ingress and the API work. No second copy of a Rancher pod is a substitute for the etcd data and credentials underneath its resources. |
| RTX worker only | Worker-only failure has no dedicated Rancher voter impact. Losing the whole RTX host also removes the configured API address and can leave the web page reachable while cluster management fails. |
| A second failure before recovery | Check surviving endpoints and capacity before further maintenance. For replicated data or voting groups, check the remaining copies and quorum. |

Losing the RTX Proxmox host takes down both its worker and control-plane VMs, including the default external API endpoint. Factor that dependency into [whole-host failure testing](/infrastructure/availability/#physical-hosts-and-the-api-endpoint).

### Upgrades and voluntary maintenance

The repository pins two replicas and required anti-affinity but does not explicitly declare a Rancher PDB or rollout strategy. Those details are chart-derived; do not claim the standard zero-surge/minimum-one contract from this Application alone.

### Availability limits

Rancher availability is bounded by ingress and the cluster API. Its local-cluster deployment cannot be your sole out-of-band recovery tool.

### Improving availability

Retain independent kubectl/Talos access, make chart-derived rollout/disruption settings explicit where needed, and measure both UI access and a real API-backed operation during one-server failure.

See [platform availability](/infrastructure/availability/) for shared dependencies and failure-test criteria.

## Configuration ownership

Keep Kubernetes resources in `apps/rancher/` and environment-specific inputs in `apps/variables.yaml`. Use the application’s backup procedure for any settings it stores in its database.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/rancher/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/rancher/certificate.yaml)

## Related guides

- [deployment guide](/admin-guide/rancher/) for setup and recovery
- [official documentation](https://ranchermanager.docs.rancher.com/) for product configuration
