---
title: "Grafana and VictoriaMetrics · Use"
description: "Use Grafana dashboards, metrics, and logs to investigate a service."
---

<nav class="guide-switcher" aria-label="Grafana and VictoriaMetrics guide sections"><a aria-current="page" href="/user-guide/victoriametrics/">Use</a><a href="/infrastructure/victoriametrics/">Architecture</a><a href="/admin-guide/victoriametrics/">Operate</a></nav>

Grafana is the dashboard interface for antalos metrics and logs. VictoriaMetrics collects and stores metrics, while VictoriaLogs serves logs from the configured collectors. Filter dashboards by service, pod, and time. Open the query behind a summary tile to see what it measures.

## Access

Open [grafana.antblu.net](https://grafana.antblu.net) or use the address your administrator gave you. Ask your administrator for access if you need an account or role.

## Investigate a service in Grafana

1. Open Grafana and select a service or infrastructure dashboard. Set a time range that includes the reported problem.

2. Read each primary application pod’s UP/DOWN state, then compare CPU vs Requested and Memory vs Requested. Requests are scheduling reservations, not usage limits.

3. Filter by namespace and pod to inspect a specific replica. Compare both replicas when a problem is intermittent.

4. Use Explore for detailed metrics or logs when the dashboard does not answer the question. Record the query, time range, and affected resource when sharing findings.

## Get help

Include the dashboard or query, time range, and missing metric or log stream. Check the freshness and coverage of the source you queried.

## During an interruption

Dashboards, metrics, and logs use separate components. A gap in one source does not necessarily mean every monitored service is down.

See [expected failure behavior and recovery](/infrastructure/victoriametrics/#availability-and-failure-behavior).

## Official documentation

Use the [official Grafana and VictoriaMetrics documentation](https://grafana.com/docs/grafana/latest/) for your installed version. Ask your administrator which optional features are enabled.

See the [architecture](/infrastructure/victoriametrics/) or [deployment guide](/admin-guide/victoriametrics/).

The [VictoriaMetrics documentation](https://docs.victoriametrics.com/) covers the metric and log services behind Grafana.
