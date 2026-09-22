---
title: "Grafana and VictoriaMetrics · Use"
description: "What Grafana and VictoriaMetrics does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Grafana and VictoriaMetrics guide sections"><a aria-current="page" href="/user-guide/victoriametrics/">Use</a><a href="/infrastructure/victoriametrics/">Architecture</a><a href="/admin-guide/victoriametrics/">Operate</a></nav>

Grafana is the dashboard interface for Antalos metrics and logs. VictoriaMetrics collects and stores metrics, while VictoriaLogs serves logs from the configured collectors. Use dashboards to narrow an investigation by service, pod, and time; a summary tile represents its query, not every part of an application.

## Access and audience

For this installation, use [grafana.antblu.net](https://grafana.antblu.net). If you use another Antalos installation, open the address supplied by its administrator. Ask for the account or role you need before starting.

## Your first workflow

1. Open Grafana and select a service or infrastructure dashboard. Set a time range that includes the reported problem.

2. Read each primary application pod’s UP/DOWN state, then compare CPU vs Requested and Memory vs Requested. Requests are scheduling reservations, not usage limits.

3. Filter by namespace and pod to inspect a specific replica. Compare both replicas when a problem is intermittent.

4. Use Explore for detailed metrics or logs when the dashboard does not answer the question. Record the query, time range, and affected resource when sharing findings.

## Get help

Include the dashboard or query, time range, and missing metric or log stream. A working dashboard does not guarantee that every data source has current or complete history.

## During an interruption

Dashboards, metrics, and logs use separate components. A gap in one source does not necessarily mean every monitored service is down.

Administrators can read [the architecture and recovery limits](/infrastructure/victoriametrics/#availability-and-failure-behavior).

## Official documentation

Use the [official Grafana and VictoriaMetrics documentation](https://grafana.com/docs/grafana/latest/) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/victoriametrics/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/victoriametrics/).

The [VictoriaMetrics documentation](https://docs.victoriametrics.com/) covers the metric and log services behind Grafana.
