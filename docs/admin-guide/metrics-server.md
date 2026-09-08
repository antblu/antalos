---
title: "Metrics Server \u00b7 Deployment and Admin Guide"
description: "Deploy Metrics Server with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="Metrics Server guide sections"><a href="/user-guide/metrics-server/">Overview and User Guide</a><a href="/infrastructure/metrics-server/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/metrics-server/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/metrics-server/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Set `METRICS_SERVER_CHART_VERSION` and deploy the official chart.

2. Ensure API aggregation and kubelet network access work. Review the configured certificate-verification exception against the cluster’s kubelet certificates before changing it.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application metrics-server

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n metrics-server get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

No OIDC configuration is needed for the service. Users access metrics through Kubernetes authentication and RBAC; the collector uses its service account.

## 4. Connect and operate the service

1. Confirm the resource-metrics API responds and that an HPA receives measurements for its target workload.

2. If tightening kubelet TLS verification, provision trusted certificates and adjust the collector before removing the current flag.

## Availability before maintenance

**Not explicitly HA: resource-metrics collection can pause until its chart workload recovers.**

Replica and rollout behavior are chart-derived here. Do not claim the repository-standard two-replica update protection without an explicit configuration.

Configure the upstream-supported HA deployment if resource-metrics continuity is required, and record HPA metrics availability during collector loss rather than checking only dashboard history.

Use the [component-by-component failure contract](/infrastructure/metrics-server/#availability-and-failure-behavior) before a node drain, database promotion, or upgrade. Restoring a healthy replica count must include data resynchronization and restored voting capacity, not just Running pods.

## 5. Maintain and recover

Collected samples are short-lived runtime data. Configuration and API access can be reconstructed; there is no application database or user file backup for this service.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

For unknown HPA utilization, inspect metrics API availability, kubelet connection errors, and pod resource requests. A working Grafana dashboard does not prove that the resource-metrics API works.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/metrics-server/app.yaml)

[Official Metrics Server documentation](https://github.com/kubernetes-sigs/metrics-server).
