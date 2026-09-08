---
title: "NFS CSI driver \u00b7 Deployment and Admin Guide"
description: "Deploy NFS CSI driver with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="NFS CSI driver guide sections"><a href="/user-guide/nfs-driver/">Overview and User Guide</a><a href="/infrastructure/nfs-driver/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/nfs-driver/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/nfs-driver/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Set `NFS_DRIVER_CHART_VERSION` and deploy the driver before NFS consumers.

2. Prepare each export, protocol version, root-squash behavior, and service runtime ownership. Keep endpoints and storage sizes in shared variables.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application nfs-driver

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n kube-system get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

There is no OIDC login for NFS CSI. Kubernetes permissions control mounts, while export rules and filesystem identities control data access. Browser identity providers do not grant NFS permissions.

## 4. Connect and operate the service

1. Mount a service’s export from its intended runtime identity and confirm required create/read/write/lock behavior during that service’s deployment.

2. Back up the NFS server and document who owns quota, snapshots, and export recovery.

## Availability before maintenance

**Not HA storage: the CSI path has node coverage, but all declared exports depend on one external endpoint.**

Updating CSI components is different from stopping the external server. Existing mounted I/O may continue during some controller outages, while new provisioning/mount work pauses.

Document or implement external NFS failover with correct locking/fencing, protect exports, and test both already-mounted I/O and a new pod mount during server/control-component failure.

Use the [component-by-component failure contract](/infrastructure/nfs-driver/#availability-and-failure-behavior) before a node drain, database promotion, or upgrade. Restoring a healthy replica count must include data resynchronization and restored voting capacity, not just Running pods.

## 5. Maintain and recover

The external export contains the data. PV/PVC objects only describe access to it. Preserve export contents, server permissions, mount protocol requirements, and backup history outside the cluster.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

For mount failures, inspect PVC binding, node-plugin events, protocol support, and network reachability. For permission errors, inspect numeric ownership and export mappings. Avoid applying recursive fsGroup changes to populated shared data as a generic fix.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/nfs-driver/app.yaml)

[Official NFS CSI driver documentation](https://github.com/kubernetes-csi/csi-driver-nfs).
