---
title: "Grafana and VictoriaMetrics \u00b7 Overview and User Guide"
description: "What Grafana and VictoriaMetrics does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Grafana and VictoriaMetrics guide sections"><a aria-current="page" href="/user-guide/victoriametrics/">Overview and User Guide</a><a href="/infrastructure/victoriametrics/">Infrastructure Explanation</a><a href="/admin-guide/victoriametrics/">Deployment and Admin Guide</a></nav>

Grafana is the dashboard interface for Antalos metrics and logs. VictoriaMetrics collects and stores metrics, while VictoriaLogs serves logs from the configured collectors. Use dashboards to narrow an investigation by service, pod, and time; a summary tile represents its query, not every part of an application.

## Access and audience

The public address is defined by `GRAFANA_HOST` in `apps/variables.yaml`. Use your deployment’s value; Antalos hostnames are examples for a fork.

## Your first workflow

1. Open Grafana and select a service or infrastructure dashboard. Set a time range that includes the reported problem.

2. Read each primary application pod’s UP/DOWN state, then compare CPU vs Requested and Memory vs Requested. Requests are scheduling reservations, not usage limits.

3. Filter by namespace and pod to inspect a specific replica. Compare both replicas when a problem is intermittent.

4. Use Explore for detailed metrics or logs when the dashboard does not answer the question. Record the query, time range, and affected resource when sharing findings.

## When you need an administrator

For missing data, follow collection, ingestion, storage, then query layers. If Grafana works but a panel is empty, inspect the query labels and time range. If HPA resource metrics are missing, inspect metrics-server; Grafana’s historical metrics pipeline is a separate system.

## Availability when using this service

**Mixed availability: Grafana and metrics have replicated designs; the current log storage is sharded, not redundantly copied.** Grafana and metrics can continue with reduced serving capacity and storage redundancy. New writes during degradation cannot acquire two independent local copies while only one storage member is available. Log history on the lost worker may be unavailable until its volume returns or is restored.

Read [how redundancy and recovery work](/infrastructure/victoriametrics/#availability-and-failure-behavior), including upgrade interruptions and external dependencies. These are design expectations, not a live status indicator.

## Official documentation

Use the [official Grafana and VictoriaMetrics documentation](https://grafana.com/docs/grafana/latest/) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/victoriametrics/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/victoriametrics/).

The [VictoriaMetrics documentation](https://docs.victoriametrics.com/) covers the metric and log services behind Grafana.
