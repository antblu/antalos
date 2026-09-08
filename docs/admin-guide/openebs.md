---
title: "OpenEBS \u00b7 Deployment and Admin Guide"
description: "Deploy OpenEBS with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="OpenEBS guide sections"><a href="/user-guide/openebs/">Overview and User Guide</a><a href="/infrastructure/openebs/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/openebs/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/openebs/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Set `OPENEBS_CHART_VERSION` and prepare the Talos host path and disk capacity.

2. Deploy the chart and `storageclass.yaml` before stateful consumers. Preserve the storage namespace’s required host-access policy and the RTX quorum toleration.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application openebs

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n openebs get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

No OIDC configuration is involved. Kubernetes RBAC, node security, and application database authentication provide the relevant access controls.

## 4. Connect and operate the service

1. For a new database, inspect claim placement and available capacity on each eligible worker.

2. Document how a lost member is recreated from its surviving peer or backup. Do not enable Mayastor merely to satisfy an HA label; it is a separate storage design.

## Availability before maintenance

**Not replicated storage: individual LocalPV volumes cannot survive loss of their owning disk as live copies.**

Provisioner/StorageClass changes need to preserve existing volume identity. Scaling a StatefulSet or editing node affinity does not copy files between disks.

Choose explicit application-level replication and restore procedures per consumer, or design a separate supported replicated-storage migration. Never describe an unreplicated local PV as HA because the provisioner has multiple pods.

Use the [component-by-component failure contract](/infrastructure/openebs/#availability-and-failure-behavior) before a node drain, database promotion, or upgrade. Restoring a healthy replica count must include data resynchronization and restored voting capacity, not just Running pods.

## 5. Maintain and recover

Volume data resides on the worker’s local disk. Losing that disk loses its local copy. Preserve application-level replication and off-node backups; Git can recreate a claim but cannot recover its previous contents.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

Pending claims can be caused by scheduling, node affinity, or missing host capacity. Determine whether the consumer must schedule before binding. Do not move a local PV’s node affinity to imply that its data exists on another node.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/openebs/app.yaml)
- [`storageclass.yaml`](https://github.com/antblu/antalos/blob/main/apps/openebs/storageclass.yaml)

[Official OpenEBS documentation](https://openebs.io/docs/).
