---
title: "Grafana and VictoriaMetrics \u00b7 Deployment and Admin Guide"
description: "Deploy Grafana and VictoriaMetrics with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="Grafana and VictoriaMetrics guide sections"><a href="/user-guide/victoriametrics/">Overview and User Guide</a><a href="/infrastructure/victoriametrics/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/victoriametrics/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/victoriametrics/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Prepare CNPG and OpenEBS, then set the monitoring storage variables, `GRAFANA_HOST`, and `VICTORIAMETRICS_CHART_VERSION`.

2. Reseal `grafana-db-app`. Keep Grafana’s external PostgreSQL settings and startup permissions intact across chart updates.

3. Account for the dedicated `log-agent` and `node-exporter` namespaces and their host-access requirements.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application victoriametrics

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n monitoring get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

The repository does not configure Grafana OIDC. Use the generated Grafana administrator Secret through your private credential workflow, then create appropriate viewer/editor access. If adding Authentik later, configure Grafana Generic OAuth with its exact `/login/generic_oauth` callback and explicit role mapping, using a sealed client secret. Document whether UI changes or Git own each setting.

## 4. Connect and operate the service

1. Confirm the provisioned data sources and dashboards can query real samples. Check scrape targets before interpreting missing metrics as zero.

2. Keep availability queries scoped to each primary serving pod. Background Jobs and unrelated namespace pods should not drive a service’s UP/DOWN tile.

3. Export durable dashboard changes into `apps/victoriametrics/` and define Grafana database backup and metrics/log retention policies.

## 5. Maintain and recover

Preserve Grafana PostgreSQL data for UI-created settings and dashboards that have not been exported to Git. Metrics and logs reside on node-local storage with configured retention. The legacy SQLite PVC is retained as migration-era data and is not the active Grafana database.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

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
