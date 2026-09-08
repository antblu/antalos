---
title: "Metrics Server \u00b7 Overview and User Guide"
description: "What Metrics Server does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Metrics Server guide sections"><a aria-current="page" href="/user-guide/metrics-server/">Overview and User Guide</a><a href="/infrastructure/metrics-server/">Infrastructure Explanation</a><a href="/admin-guide/metrics-server/">Deployment and Admin Guide</a></nav>

Metrics Server supplies recent CPU and memory measurements to the Kubernetes resource-metrics API. Horizontal Pod Autoscalers and `kubectl top` use it. Historical dashboards in Grafana use a different collection and storage pipeline.

## Access and audience

This is a platform service with no standalone user-facing website. Its consumers use Kubernetes resources or internal endpoints.

## Your first workflow

1. Use resource metrics to inspect current pod and node usage when diagnosing scheduling or autoscaling.

2. Read an HPA’s current and target utilization alongside the workload’s resource requests. Missing requests or metrics can prevent scaling decisions.

3. Use Grafana for historical analysis; Metrics Server does not provide a long-term time-series database.

## When you need an administrator

For unknown HPA utilization, inspect metrics API availability, kubelet connection errors, and pod resource requests. A working Grafana dashboard does not prove that the resource-metrics API works.

## Official documentation

Use the [official Metrics Server documentation](https://github.com/kubernetes-sigs/metrics-server) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/metrics-server/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/metrics-server/).
