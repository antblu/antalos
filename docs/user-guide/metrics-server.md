---
title: "Metrics Server · Use"
description: "What Metrics Server does, how to use it in antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Metrics Server guide sections"><a aria-current="page" href="/user-guide/metrics-server/">Use</a><a href="/infrastructure/metrics-server/">Architecture</a><a href="/admin-guide/metrics-server/">Operate</a></nav>

Metrics Server supplies recent CPU and memory measurements to the Kubernetes resource-metrics API. Horizontal Pod Autoscalers and `kubectl top` use it. Historical dashboards in Grafana use a different collection and storage pipeline.

## Access and audience

This is a platform service with no standalone user-facing website. Its consumers use Kubernetes resources or internal endpoints.

## Your first workflow

1. Use resource metrics to inspect current pod and node usage when diagnosing scheduling or autoscaling.

2. Read an HPA’s current and target utilization alongside the workload’s resource requests. Missing requests or metrics can prevent scaling decisions.

3. Use Grafana for historical analysis; Metrics Server does not provide a long-term time-series database.

## Get help

Report missing resource measurements and the relevant cluster or namespace. This service provides recent resource data; long-term dashboards use the separate monitoring system.

## During an interruption

An interruption can affect the applications that depend on this platform service. Ask the administrator to identify the affected service and expected recovery path.

Administrators can read [the architecture and recovery limits](/infrastructure/metrics-server/#availability-and-failure-behavior).

## Official documentation

Use the [official Metrics Server documentation](https://github.com/kubernetes-sigs/metrics-server) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/metrics-server/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/metrics-server/).
