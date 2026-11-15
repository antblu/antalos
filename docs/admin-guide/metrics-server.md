---
title: "Metrics Server · Operate"
description: "Install Metrics Server and check kubelet access and HPA measurements."
---

<nav class="guide-switcher" aria-label="Metrics Server guide sections"><a href="/user-guide/metrics-server/">Use</a><a href="/infrastructure/metrics-server/">Architecture</a><a aria-current="page" href="/admin-guide/metrics-server/">Operate</a></nav>

Use `apps/metrics-server/` with the [shared deployment workflow](/admin-guide/deploy-an-application/) to render manifests, prepare credentials, and reconcile the Application.

## 1. Prepare dependencies and inputs

1. Set `METRICS_SERVER_CHART_VERSION` and deploy the official chart.

2. Ensure API aggregation and kubelet network access work. Review the configured certificate-verification exception against the cluster’s kubelet certificates before changing it.

## 2. Reconcile the application

Push the reviewed manifests and variables to the branch Argo CD tracks. Let the root app-of-apps discover the Application and run its hooks in order. Keep unresolved templates out of direct Kubernetes applies.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application metrics-server

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n metrics-server get pods,svc,pvc
```

Confirm the expected Git revision synced and the required workloads are ready. Then test the service.

## 3. Complete identity and first access

No OIDC configuration is needed for the service. Users access metrics through Kubernetes authentication and RBAC; the collector uses its service account.

## 4. Connect and operate the service

1. Confirm the resource-metrics API responds and that an HPA receives measurements for its target workload.

2. If tightening kubelet TLS verification, provision trusted certificates and adjust the collector before removing the current flag.

## Availability before maintenance

**Not explicitly HA: resource-metrics collection can pause until its chart workload recovers.**

Replica and rollout behavior are chart-derived here. Do not claim the repository-standard two-replica update protection without an explicit configuration.

If you need uninterrupted resource metrics, use the upstream HA deployment and check whether the HPA receives measurements after losing a collector.

Review [failure behavior](/infrastructure/metrics-server/#availability-and-failure-behavior) before maintenance.

## 5. Maintain and recover

Collected samples are short-lived runtime data. Configuration and API access can be reconstructed; there is no application database or user file backup for this service.

Read the target version’s release notes and record a recovery point before upgrading. See [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/).

## Troubleshooting

For unknown HPA utilization, inspect metrics API availability, kubelet connection errors, and pod resource requests. A working Grafana dashboard does not prove that the resource-metrics API works.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/metrics-server/app.yaml)

[Official Metrics Server documentation](https://github.com/kubernetes-sigs/metrics-server).

## Duplicate legacy installation

The supported Metrics Server runs in the `metrics-server` namespace through its Argo CD Application. The aggregated `v1beta1.metrics.k8s.io` APIService must point at that namespace. A former manually applied Deployment named `metrics-server` in `kube-system` is redundant and can crash with a forbidden read of `extension-apiserver-authentication` after the shared RBAC moves to the chart-managed service account. The redundant `kube-system/metrics-server` Deployment was removed during the 2026-10-21 incident after confirming APIService ownership. For any recurrence, remove that unused Deployment after confirming APIService ownership; do not grant it additional permissions or remove the chart's shared ClusterRoles and bindings. No Talos/OpenTofu source installs the former Deployment.
