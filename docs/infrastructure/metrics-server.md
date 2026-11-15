---
title: "Metrics Server · Architecture"
description: "Kubelet collection, API aggregation, and dependencies for autoscaling."
---

<nav class="guide-switcher" aria-label="Metrics Server guide sections"><a href="/user-guide/metrics-server/">Use</a><a aria-current="page" href="/infrastructure/metrics-server/">Architecture</a><a href="/admin-guide/metrics-server/">Operate</a></nav>

The official chart runs in `metrics-server` and collects from kubelets through the aggregated API path. The current Application passes `--kubelet-insecure-tls`, which disables kubelet certificate verification for this connection.

## Components

<figure class="architecture-diagram" aria-label="Metrics Server · component flow">
<div class="diagram-heading">Metrics Server · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Measure</span><ul><li>Node kubelets</li><li>Recent CPU / memory</li></ul></li><li class="diagram-stage"><span class="diagram-label">Aggregate</span><ul><li>Metrics Server</li><li>Kubernetes aggregated metrics API</li></ul></li><li class="diagram-stage"><span class="diagram-label">Consume</span><ul><li>HPA scaling decisions</li><li>kubectl top</li></ul></li></ol>
</figure>

## Data and recovery

Collected samples are short-lived runtime data. Configuration and API access can be reconstructed; there is no application database or user file backup for this service.

## Availability and failure behavior

**Not explicitly HA: resource-metrics collection can pause until its chart workload recovers.**

The expected behavior assumes healthy replicas with the intended placement and reachable dependencies. Verify it in a failure drill on your deployment.

### Component redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Collector | No explicit replica override | The manifest does not establish a redundant collector topology. |
| Metrics API | Aggregated Kubernetes API | HPA and kubectl top depend on current samples and API availability. |
| History | No persistent metrics archive here | VictoriaMetrics is a separate historical pipeline. |

### Failover and recovery

Kubernetes replaces the failed collector and it must scrape kubelets again before useful measurements return. HPA behavior during missing samples follows its policy and existing recommendations; it is not evidence that applications themselves have crashed.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | If the collector was on that worker, resource metrics may be missing. Existing application replicas can keep serving even while some scaling decisions are impaired. |
| RTX worker only | No dedicated voter. Losing the whole host’s API endpoint can affect metrics queries even if the collector still runs. |
| A second failure before recovery | Check surviving endpoints and capacity before further maintenance. For replicated data or voting groups, check the remaining copies and quorum. |

Losing the RTX Proxmox host takes down both its worker and control-plane VMs, including the default external API endpoint. Factor that dependency into [whole-host failure testing](/infrastructure/availability/#physical-hosts-and-the-api-endpoint).

### Upgrades and voluntary maintenance

Replica and rollout behavior are chart-derived here. Do not claim the repository-standard two-replica update protection without an explicit configuration.

### Availability limits

Historical Grafana samples do not substitute for the resource-metrics API used by HPA. Kubelet network and TLS configuration are also collector dependencies.

### Improving availability

If you need uninterrupted resource metrics, use the upstream HA deployment and check whether the HPA receives measurements after losing a collector.

See [platform availability](/infrastructure/availability/) for shared dependencies and failure-test criteria.

## Configuration ownership

Keep Kubernetes resources in `apps/metrics-server/` and environment-specific inputs in `apps/variables.yaml`. Use the application’s backup procedure for any settings it stores in its database.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/metrics-server/app.yaml)

## Related guides

- [deployment guide](/admin-guide/metrics-server/) for setup and recovery
- [official documentation](https://github.com/kubernetes-sigs/metrics-server) for product configuration
