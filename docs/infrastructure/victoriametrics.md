---
title: "Grafana and VictoriaMetrics \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for Grafana and VictoriaMetrics in Antalos."
---

<nav class="guide-switcher" aria-label="Grafana and VictoriaMetrics guide sections"><a href="/user-guide/victoriametrics/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/victoriametrics/">Infrastructure Explanation</a><a href="/admin-guide/victoriametrics/">Deployment and Admin Guide</a></nav>

Two vmagent replicas scrape targets. The VictoriaMetrics cluster has two replicas each of vminsert, vmselect, and vmstorage with replication factor two and sample deduplication. VictoriaLogs also has paired insert/select/storage roles, but its storage nodes hold shards rather than redundant copies of all logs. Two Grafana replicas share a two-instance CNPG database. Dashboard ConfigMaps are provisioned from Git; collectors and exporters run near their targets.

## Component boundaries

<figure class="architecture-diagram" aria-label="Grafana and VictoriaMetrics · component flow">
<div class="diagram-heading">Grafana and VictoriaMetrics · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Collect</span><ul><li>2 vmagent scrapers</li><li>Node exporters / log collectors</li></ul></li><li class="diagram-stage"><span class="diagram-label">Store</span><ul><li>Metrics · 2-way replication</li><li>Logs · 2 storage processes</li><li>Node-local persistent volumes</li></ul></li><li class="diagram-stage"><span class="diagram-label">Explore</span><ul><li>2 Grafana + PostgreSQL pair</li><li>Metrics / log query services</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Preserve Grafana PostgreSQL data for UI-created settings and dashboards that have not been exported to Git. Metrics and logs reside on node-local storage with configured retention. The legacy SQLite PVC is retained as migration-era data and is not the active Grafana database.

## Availability and failure behavior

**Availability classification: Mixed availability: Grafana and metrics have replicated designs; the current log storage is sharded, not redundantly copied.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Grafana | 2 anti-affined pods + 2 CNPG instances | Shared PostgreSQL prevents separate per-pod dashboard/session databases. |
| Metrics collection | 2 vmagent replicas | Duplicate scraping is paired with deduplication in the query/storage design. |
| Metrics cluster | 2 each of vminsert, vmselect, vmstorage; replicationFactor 2 | Metrics ingestion requests redundant storage copies; query frontends can use surviving storage. |
| Logs | 2 each of vlinsert, vlselect, vlstorage | Storage nodes hold different shards; frontend replication does not duplicate every log. |
| Management / collectors | 1 VictoriaMetrics operator; node-local collectors | Reconciliation and local data capture have separate availability limits. |

### How a failure is handled

A Grafana request can retry on the other pod, with database promotion when needed. Metrics can retain a surviving storage copy when samples were successfully replicated before the failure. VictoriaLogs has a different contract: losing a storage node removes access to its shard and can make queries incomplete or fail; the other pod is not a full copy.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | Grafana and metrics can continue with reduced serving capacity and storage redundancy. New writes during degradation cannot acquire two independent local copies while only one storage member is available. Log history on the lost worker may be unavailable until its volume returns or is restored. |
| RTX worker only | No dedicated metrics/Grafana database voter is declared on RTX. Whole-host API failure can still stop operator-driven promotion and repair. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

Grafana uses zero surge/one unavailable with a PDB. Metrics and logs have role-specific updates; two storage pods do not mean a log-storage rolling restart has complete-history query availability. The single operator may pause reconciliation during replacement.

### What prevents a stronger HA claim

Both metrics storage volumes remain node-local. Do not assume old metrics missing from one member are automatically backfilled merely because a second pod later becomes Ready. Log replication would require an explicit supported design, such as ingestion into independent copies/clusters and query failover, not the metrics replicationFactor copied onto a log CR.

### What would improve the availability contract

Test Grafana, metric query completeness, degraded metric ingestion, and log completeness separately. Protect all storage shards and the Grafana database. Add a supported independent-copy log architecture if full log-history HA is required.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

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
