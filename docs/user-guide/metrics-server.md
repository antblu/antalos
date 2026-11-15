---
title: "Metrics Server · Use"
description: "Read CPU and memory usage from the Kubernetes resource-metrics API."
---

<nav class="guide-switcher" aria-label="Metrics Server guide sections"><a aria-current="page" href="/user-guide/metrics-server/">Use</a><a href="/infrastructure/metrics-server/">Architecture</a><a href="/admin-guide/metrics-server/">Operate</a></nav>

Metrics Server supplies recent CPU and memory measurements to the Kubernetes resource-metrics API. Horizontal Pod Autoscalers and `kubectl top` use it. Historical dashboards in Grafana use a different collection and storage pipeline.

## Access

Use Kubernetes resources or internal endpoints to work with this service.

## Inspect resource usage

1. Use resource metrics to inspect current pod and node usage when diagnosing scheduling or autoscaling.

2. Read an HPA’s current and target utilization alongside the workload’s resource requests. Missing requests or metrics can prevent scaling decisions.

3. Use Grafana for historical analysis; Metrics Server does not provide a long-term time-series database.

## Get help

Report missing resource measurements and the relevant cluster or namespace. This service provides recent resource data; long-term dashboards use the separate monitoring system.

## During an interruption

If resource metrics stop arriving, check whether `kubectl top` and the HPA still have measurements.

See [expected failure behavior and recovery](/infrastructure/metrics-server/#availability-and-failure-behavior).

## Official documentation

Use the [official Metrics Server documentation](https://github.com/kubernetes-sigs/metrics-server) for your installed version. Ask your administrator which optional features are enabled.

See the [architecture](/infrastructure/metrics-server/) or [deployment guide](/admin-guide/metrics-server/).
