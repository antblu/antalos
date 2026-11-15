---
title: "Grafana and VictoriaMetrics · Operate"
description: "Deploy the monitoring stack and verify metrics and log queries."
---

<nav class="guide-switcher" aria-label="Grafana and VictoriaMetrics guide sections"><a href="/user-guide/victoriametrics/">Use</a><a href="/infrastructure/victoriametrics/">Architecture</a><a aria-current="page" href="/admin-guide/victoriametrics/">Operate</a></nav>

Use `apps/victoriametrics/` with the [shared deployment workflow](/admin-guide/deploy-an-application/) to render manifests, prepare credentials, and reconcile the Application.

## 1. Prepare dependencies and inputs

1. Prepare CNPG and OpenEBS, then set the monitoring storage variables, `GRAFANA_HOST`, and `VICTORIAMETRICS_CHART_VERSION`.

2. Reseal `grafana-db-app`. Keep Grafana’s external PostgreSQL settings and startup permissions intact across chart updates.

3. Account for the dedicated `log-agent` and `node-exporter` namespaces and their host-access requirements.

## 2. Reconcile the application

Push the reviewed manifests and variables to the branch Argo CD tracks. Let the root app-of-apps discover the Application and run its hooks in order. Keep unresolved templates out of direct Kubernetes applies.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application victoriametrics

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n monitoring get pods,svc,pvc
```

Confirm the expected Git revision synced and the required workloads are ready. Wait for any initialization or migration Jobs to finish, then test the service.

## 3. Complete identity and first access

The repository supplies the Generic OAuth role mapping (`grafana-admins` becomes organization `Admin`, otherwise `Viewer`) and enables role synchronization. The provider connection, credentials and enablement remain separately configured. Use the generated Grafana administrator Secret through your private credential workflow, then create appropriate viewer/editor access. If adding Authentik later, configure Grafana Generic OAuth with its exact `/login/generic_oauth` callback and explicit role mapping, using a sealed client secret. Document whether UI changes or Git own each setting.

## 4. Connect and operate the service

1. Confirm the provisioned data sources and dashboards can query real samples. Check scrape targets before interpreting missing metrics as zero.

2. Keep availability queries scoped to each primary serving pod. Background Jobs and unrelated namespace pods should not drive a service’s UP/DOWN tile.

3. Export durable dashboard changes into `apps/victoriametrics/` and define Grafana database backup and metrics/log retention policies.

## Availability before maintenance

**Mixed availability: Grafana and metrics have replicated designs; the current log storage is sharded, not redundantly copied.**

Grafana uses zero surge/one unavailable with a PDB. Metrics and logs have role-specific updates; two storage pods do not mean a log-storage rolling restart has complete-history query availability. The single operator may pause reconciliation during replacement.

Test Grafana, metric query completeness, degraded metric ingestion, and log completeness separately. Protect all storage shards and the Grafana database. Add a supported independent-copy log architecture if full log-history HA is required.

Review [failure behavior](/infrastructure/victoriametrics/#availability-and-failure-behavior) before maintenance. If the service uses replication or quorum, confirm data has resynchronized and voting capacity has recovered.

## 5. Maintain and recover

Preserve Grafana PostgreSQL data for UI-created settings and dashboards that have not been exported to Git. Metrics and logs reside on node-local storage with configured retention. The legacy SQLite PVC is retained as migration-era data and is not the active Grafana database.

Read the target version’s release notes and record a recovery point before upgrading. If the release migrates a database schema, plan how to restore the database before rolling back the image. See [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/).

## Troubleshooting

For missing data, follow collection, ingestion, storage, then query layers. If Grafana works but a panel is empty, inspect the query labels and time range. If HPA resource metrics are missing, inspect metrics-server; Grafana’s historical metrics pipeline is a separate system.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/victoriametrics/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/victoriametrics/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/victoriametrics/database.yaml)
- [`db-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/victoriametrics/db-secret.yaml)
- [`legacy-sqlite-storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/victoriametrics/legacy-sqlite-storage.yaml)
- [`log-agent-namespace.yaml`](https://github.com/antblu/antalos/blob/main/apps/victoriametrics/log-agent-namespace.yaml)
- [`node-exporter-namespace.yaml`](https://github.com/antblu/antalos/blob/main/apps/victoriametrics/node-exporter-namespace.yaml)

[Official Grafana and VictoriaMetrics documentation](https://grafana.com/docs/grafana/latest/).
