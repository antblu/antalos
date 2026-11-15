---
title: "Grafana and VictoriaMetrics · Architecture"
description: "Grafana, VictoriaMetrics, VictoriaLogs, and their persistence."
---

<nav class="guide-switcher" aria-label="Grafana and VictoriaMetrics guide sections"><a href="/user-guide/victoriametrics/">Use</a><a aria-current="page" href="/infrastructure/victoriametrics/">Architecture</a><a href="/admin-guide/victoriametrics/">Operate</a></nav>

Two vmagent replicas scrape targets. The VictoriaMetrics cluster has two replicas each of vminsert, vmselect, and vmstorage with replication factor two and sample deduplication. VictoriaLogs also has paired insert/select/storage roles, but its storage nodes hold shards rather than redundant copies of all logs. Two Grafana replicas share a two-instance CNPG database. Dashboard ConfigMaps are provisioned from Git; collectors and exporters run near their targets.

## Components

<figure class="architecture-diagram" aria-label="Grafana and VictoriaMetrics · component flow">
<div class="diagram-heading">Grafana and VictoriaMetrics · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Collect</span><ul><li>2 vmagent scrapers</li><li>Node exporters / log collectors</li></ul></li><li class="diagram-stage"><span class="diagram-label">Store</span><ul><li>Metrics · 2-way replication</li><li>Logs · 2 storage processes</li><li>Node-local persistent volumes</li></ul></li><li class="diagram-stage"><span class="diagram-label">Explore</span><ul><li>2 Grafana + PostgreSQL pair</li><li>Metrics / log query services</li></ul></li></ol>
</figure>

## Data and recovery

Preserve Grafana PostgreSQL data for UI-created settings and dashboards that have not been exported to Git. Metrics and logs reside on node-local storage with configured retention. The legacy SQLite PVC is retained as migration-era data and is not the active Grafana database.

## Availability and failure behavior

**Mixed availability: Grafana and metrics have replicated designs; the current log storage is sharded, not redundantly copied.**

The expected behavior assumes healthy replicas with the intended placement and reachable dependencies. Verify it in a failure drill on your deployment.

### Component redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Grafana | 2 anti-affined pods + 2 CNPG instances | Shared PostgreSQL prevents separate per-pod dashboard/session databases. |
| Metrics collection | 2 vmagent replicas | Duplicate scraping is paired with deduplication in the query/storage design. |
| Metrics cluster | 2 each of vminsert, vmselect, vmstorage; replicationFactor 2 | Metrics ingestion requests redundant storage copies; query frontends can use surviving storage. |
| Logs | 2 each of vlinsert, vlselect, vlstorage | Storage nodes hold different shards; frontend replication does not duplicate every log. |
| Management / collectors | 1 VictoriaMetrics operator; node-local collectors | Reconciliation and local data capture have separate availability limits. |

### Failover and recovery

A Grafana request can retry on the other pod, with database promotion when needed. Metrics can retain a surviving storage copy when samples were successfully replicated before the failure. VictoriaLogs has a different contract: losing a storage node removes access to its shard and can make queries incomplete or fail; the other pod is not a full copy.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | Grafana and metrics can continue with reduced serving capacity and storage redundancy. New writes during degradation cannot acquire two independent local copies while only one storage member is available. Log history on the lost worker may be unavailable until its volume returns or is restored. |
| RTX worker only | No dedicated metrics/Grafana database voter is declared on RTX. Whole-host API failure can still stop operator-driven promotion and repair. |
| A second failure before recovery | Check surviving endpoints and capacity before further maintenance. For replicated data or voting groups, check the remaining copies and quorum. |

Losing the RTX Proxmox host takes down both its worker and control-plane VMs, including the default external API endpoint. Factor that dependency into [whole-host failure testing](/infrastructure/availability/#physical-hosts-and-the-api-endpoint).

### Upgrades and voluntary maintenance

Grafana uses zero surge/one unavailable with a PDB. Metrics and logs have role-specific updates; two storage pods do not mean a log-storage rolling restart has complete-history query availability. The single operator may pause reconciliation during replacement.

### Availability limits

Both metrics storage volumes remain node-local. Do not assume old metrics missing from one member are automatically backfilled merely because a second pod later becomes Ready. Log replication would require an explicit supported design, such as ingestion into independent copies/clusters and query failover, not the metrics replicationFactor copied onto a log CR.

### Improving availability

Test Grafana, metric query completeness, degraded metric ingestion, and log completeness separately. Protect all storage shards and the Grafana database. Add a supported independent-copy log architecture if full log-history HA is required.

See [platform availability](/infrastructure/availability/) for shared dependencies and failure-test criteria.

## Configuration ownership

Keep Kubernetes resources in `apps/victoriametrics/` and environment-specific inputs in `apps/variables.yaml`. Use the application’s backup procedure for any settings it stores in its database.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/victoriametrics/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/victoriametrics/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/victoriametrics/database.yaml)
- [`db-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/victoriametrics/db-secret.yaml)
- [`legacy-sqlite-storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/victoriametrics/legacy-sqlite-storage.yaml)
- [`log-agent-namespace.yaml`](https://github.com/antblu/antalos/blob/main/apps/victoriametrics/log-agent-namespace.yaml)
- [`node-exporter-namespace.yaml`](https://github.com/antblu/antalos/blob/main/apps/victoriametrics/node-exporter-namespace.yaml)

## Related guides

- [deployment guide](/admin-guide/victoriametrics/) for setup and recovery
- [official documentation](https://grafana.com/docs/grafana/latest/) for product configuration
