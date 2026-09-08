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

The manifest does not explicitly increase chart replicas. A service outage can remove resource metrics and affect autoscaling decisions while workloads themselves keep running.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/metrics-server/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/metrics-server/app.yaml)

## Continue

Read the [deployment guide](/admin-guide/metrics-server/) for dependency order, initial credentials, and integration work. The [official documentation](https://github.com/kubernetes-sigs/metrics-server) explains the upstream product; the topology above describes this repository.
