---
title: "Grafana and VictoriaMetrics \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for Grafana and VictoriaMetrics in Antalos."
---

<nav class="guide-switcher" aria-label="Grafana and VictoriaMetrics guide sections"><a href="/user-guide/victoriametrics/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/victoriametrics/">Infrastructure Explanation</a><a href="/admin-guide/victoriametrics/">Deployment and Admin Guide</a></nav>

Two vmagent replicas scrape targets. The VictoriaMetrics cluster has two replicas each of vminsert, vmselect, and vmstorage with replication factor two and sample deduplication. VictoriaLogs also has paired insert/select/storage roles, but the manifest does not explicitly declare a log replication factor. Two Grafana replicas share a two-instance CNPG database. Dashboard ConfigMaps are provisioned from Git; collectors and exporters run near their targets.

## Component boundaries

<figure class="architecture-diagram" aria-label="Grafana and VictoriaMetrics · component flow">
<div class="diagram-heading">Grafana and VictoriaMetrics · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Collect</span><ul><li>2 vmagent scrapers</li><li>Node exporters / log collectors</li></ul></li><li class="diagram-stage"><span class="diagram-label">Store</span><ul><li>Metrics · 2-way replication</li><li>Logs · 2 storage processes</li><li>Node-local persistent volumes</li></ul></li><li class="diagram-stage"><span class="diagram-label">Explore</span><ul><li>2 Grafana + PostgreSQL pair</li><li>Metrics / log query services</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Preserve Grafana PostgreSQL data for UI-created settings and dashboards that have not been exported to Git. Metrics and logs reside on node-local storage with configured retention. The legacy SQLite PVC is retained as migration-era data and is not the active Grafana database.

## Availability and failure behavior

Metrics and Grafana serving tiers are replicated. Two log storage pods do not prove that every log has two copies. The VictoriaMetrics operator is single-instance; collector outages can leave gaps even when query frontends remain healthy.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/victoriametrics/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/victoriametrics/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/victoriametrics/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/victoriametrics/database.yaml)
- [`db-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/victoriametrics/db-secret.yaml)
- [`legacy-sqlite-storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/victoriametrics/legacy-sqlite-storage.yaml)
- [`log-agent-namespace.yaml`](https://github.com/antblu/antalos/blob/main/apps/victoriametrics/log-agent-namespace.yaml)
- [`node-exporter-namespace.yaml`](https://github.com/antblu/antalos/blob/main/apps/victoriametrics/node-exporter-namespace.yaml)

## Continue

Read the [deployment guide](/admin-guide/victoriametrics/) for dependency order, initial credentials, and integration work. The [official documentation](https://grafana.com/docs/grafana/latest/) explains the upstream product; the topology above describes this repository.
