---
title: "CloudNativePG \u00b7 Deployment and Admin Guide"
description: "Deploy CloudNativePG with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="CloudNativePG guide sections"><a href="/user-guide/cnpg-operator/">Overview and User Guide</a><a href="/infrastructure/cnpg-operator/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/cnpg-operator/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/cnpg-operator/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Install the pinned chart and CRDs before any `postgresql.cnpg.io` resources.

2. Prepare OpenEBS and schedulable storage on both main workers. Create and seal the application owner Secret before database bootstrap.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application cnpg-operator

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n cnpg-system get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

There is no user-facing OIDC configuration. Database authentication uses the Secret and PostgreSQL roles declared by the consuming service; Kubernetes RBAC controls operator resources. Keep application roles scoped to their own databases.

## 4. Connect and operate the service

1. For each consumer, confirm the read/write endpoint and owner/database names match its connection settings.

2. Add a backup design per cluster; replication alone does not create an off-cluster backup. Rehearse restore into a new isolated cluster.

## Availability before maintenance

**Not explicitly HA as an operator; it manages replicated database clusters with separate availability contracts.**

Operator restarts and CRD upgrades can pause management while databases keep serving. Perform application database upgrades according to each cluster’s policy, not by treating the operator rollout as the database rollout.

Make operator leader-election/replica behavior explicit for the pinned chart, protect API access, and measure primary loss both with and without a simultaneous operator disruption. Keep backup policy per database.

Use the [component-by-component failure contract](/infrastructure/cnpg-operator/#availability-and-failure-behavior) before a node drain, database promotion, or upgrade. Restoring a healthy replica count must include data resynchronization and restored voting capacity, not just Running pods.

## 5. Maintain and recover

Database data and backups belong to each managed cluster. The operator chart is reconstructable from Git. Preserve database credentials, backup credentials, WAL/base backups where configured, and the sealing key.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

For failed members, inspect Cluster conditions, pod placement, PVC events, and PostgreSQL logs. Do not delete the only surviving volume to clear a Pending condition. Determine the current primary before any recovery operation.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/cnpg-operator/app.yaml)

[Official CloudNativePG documentation](https://cloudnative-pg.io/documentation/).
