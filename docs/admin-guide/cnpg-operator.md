---
title: "CloudNativePG · Operate"
description: "Install CloudNativePG and prepare application database recovery."
---

<nav class="guide-switcher" aria-label="CloudNativePG guide sections"><a href="/user-guide/cnpg-operator/">Use</a><a href="/infrastructure/cnpg-operator/">Architecture</a><a aria-current="page" href="/admin-guide/cnpg-operator/">Operate</a></nav>

Use `apps/cnpg-operator/` with the [shared deployment workflow](/admin-guide/deploy-an-application/) to render manifests, prepare credentials, and reconcile the Application.

## 1. Prepare dependencies and inputs

1. Install the pinned chart and CRDs before any `postgresql.cnpg.io` resources.

2. Prepare OpenEBS and schedulable storage on both main workers. Create and seal the application owner Secret before database bootstrap.

## 2. Reconcile the application

Push the reviewed manifests and variables to the branch Argo CD tracks. Let the root app-of-apps discover the Application and run its hooks in order. Keep unresolved templates out of direct Kubernetes applies.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application cnpg-operator

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n cnpg-system get pods,svc,pvc
```

Confirm the expected Git revision synced and the required workloads are ready. Then test the service.

## 3. Complete identity and first access

There is no user-facing OIDC configuration. Database authentication uses the Secret and PostgreSQL roles declared by the consuming service; Kubernetes RBAC controls operator resources. Keep application roles scoped to their own databases.

## 4. Connect and operate the service

1. For each consumer, confirm the read/write endpoint and owner/database names match its connection settings.

2. Add a backup design per cluster; replication alone does not create an off-cluster backup. Rehearse restore into a new isolated cluster.

## Availability before maintenance

**Redundant operator management with leader election; managed database availability remains service-specific.**

Operator restarts and CRD upgrades can pause management while databases keep serving. Perform application database upgrades according to each cluster’s policy, not by treating the operator rollout as the database rollout.

Protect API access and measure primary loss with simultaneous operator leader loss. Keep backup policy per database.

Review [failure behavior](/infrastructure/cnpg-operator/#availability-and-failure-behavior) before maintenance.

## 5. Maintain and recover

Database data and backups belong to each managed cluster. The operator chart is reconstructable from Git. Preserve database credentials, backup credentials, WAL/base backups where configured, and the sealing key.

Read the target version’s release notes and record a recovery point before upgrading. See [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/).

## Troubleshooting

For failed members, inspect Cluster conditions, pod placement, PVC events, and PostgreSQL logs. Do not delete the only surviving volume to clear a Pending condition. Determine the current primary before any recovery operation.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/cnpg-operator/app.yaml)

[Official CloudNativePG documentation](https://cloudnative-pg.io/documentation/).
