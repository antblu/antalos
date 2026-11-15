---
title: "OpenEBS · Operate"
description: "Configure OpenEBS storage classes and plan node-local data recovery."
---

<nav class="guide-switcher" aria-label="OpenEBS guide sections"><a href="/user-guide/openebs/">Use</a><a href="/infrastructure/openebs/">Architecture</a><a aria-current="page" href="/admin-guide/openebs/">Operate</a></nav>

Use `apps/openebs/` with the [shared deployment workflow](/admin-guide/deploy-an-application/) to render manifests, prepare credentials, and reconcile the Application.

## 1. Prepare dependencies and inputs

1. Set `OPENEBS_CHART_VERSION` and prepare the Talos host path and disk capacity.

2. Deploy the chart and `storageclass.yaml` before stateful consumers. Preserve the storage namespace’s required host-access policy and the RTX quorum toleration.

## 2. Reconcile the application

Push the reviewed manifests and variables to the branch Argo CD tracks. Let the root app-of-apps discover the Application and run its hooks in order. Keep unresolved templates out of direct Kubernetes applies.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application openebs

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n openebs get pods,svc,pvc
```

Confirm the expected Git revision synced and the required workloads are ready. Then test the service.

## 3. Complete identity and first access

No OIDC configuration is involved. Kubernetes RBAC, node security, and application database authentication provide the relevant access controls.

## 4. Connect and operate the service

1. For a new database, inspect claim placement and available capacity on each eligible worker.

2. Document how a lost member is recreated from its surviving peer or backup. Do not enable Mayastor merely to satisfy an HA label; it is a separate storage design.

## Availability before maintenance

**Not replicated storage: individual LocalPV volumes cannot survive loss of their owning disk as live copies.**

Provisioner/StorageClass changes need to preserve existing volume identity. Scaling a StatefulSet or editing node affinity does not copy files between disks.

Choose explicit application-level replication and restore procedures per consumer, or design a separate supported replicated-storage migration. Never describe an unreplicated local PV as HA because the provisioner has multiple pods.

Review [failure behavior](/infrastructure/openebs/#availability-and-failure-behavior) before maintenance.

## 5. Maintain and recover

Volume data resides on the worker’s local disk. Losing that disk loses its local copy. Preserve application-level replication and off-node backups; Git can recreate a claim but cannot recover its previous contents.

Read the target version’s release notes and record a recovery point before upgrading. See [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/).

## Troubleshooting

Pending claims can be caused by scheduling, node affinity, or missing host capacity. Determine whether the consumer must schedule before binding. Do not move a local PV’s node affinity to imply that its data exists on another node.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/openebs/app.yaml)
- [`storageclass.yaml`](https://github.com/antblu/antalos/blob/main/apps/openebs/storageclass.yaml)

[Official OpenEBS documentation](https://openebs.io/docs/).
