---
title: "Metrics Server \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for Metrics Server in Antalos."
---

<nav class="guide-switcher" aria-label="Metrics Server guide sections"><a href="/user-guide/metrics-server/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/metrics-server/">Infrastructure Explanation</a><a href="/admin-guide/metrics-server/">Deployment and Admin Guide</a></nav>

The official chart runs in `metrics-server` and collects from kubelets through the aggregated API path. The current Application passes `--kubelet-insecure-tls`, which disables kubelet certificate verification for this connection.

## Component boundaries

<figure class="architecture-diagram" aria-label="Metrics Server · component flow">
<div class="diagram-heading">Metrics Server · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Measure</span><ul><li>Node kubelets</li><li>Recent CPU / memory</li></ul></li><li class="diagram-stage"><span class="diagram-label">Aggregate</span><ul><li>Metrics Server</li><li>Kubernetes aggregated metrics API</li></ul></li><li class="diagram-stage"><span class="diagram-label">Consume</span><ul><li>HPA scaling decisions</li><li>kubectl top</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Collected samples are short-lived runtime data. Configuration and API access can be reconstructed; there is no application database or user file backup for this service.

## Availability and failure behavior

**Availability classification: Not explicitly HA: resource-metrics collection can pause until its chart workload recovers.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Collector | No explicit replica override | The manifest does not establish a redundant collector topology. |
| Metrics API | Aggregated Kubernetes API | HPA and kubectl top depend on current samples and API availability. |
| History | No persistent metrics archive here | VictoriaMetrics is a separate historical pipeline. |

### How a failure is handled

Kubernetes replaces the failed collector and it must scrape kubelets again before useful measurements return. HPA behavior during missing samples follows its policy and existing recommendations; it is not evidence that applications themselves have crashed.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | If the collector was on that worker, resource metrics may be missing. Existing application replicas can keep serving even while some scaling decisions are impaired. |
| RTX worker only | No dedicated voter. Losing the whole host’s API endpoint can affect metrics queries even if the collector still runs. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

Replica and rollout behavior are chart-derived here. Do not claim the repository-standard two-replica update protection without an explicit configuration.

### What prevents a stronger HA claim

Historical Grafana samples do not substitute for the resource-metrics API used by HPA. Kubelet network and TLS configuration are also collector dependencies.

### What would improve the availability contract

Configure the upstream-supported HA deployment if resource-metrics continuity is required, and record HPA metrics availability during collector loss rather than checking only dashboard history.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/metrics-server/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/metrics-server/app.yaml)

## Continue

Read the [deployment guide](/admin-guide/metrics-server/) for dependency order, initial credentials, and integration work. The [official documentation](https://github.com/kubernetes-sigs/metrics-server) explains the upstream product; the topology above describes this repository.
