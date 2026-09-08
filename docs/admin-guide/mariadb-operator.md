---
title: "MariaDB operator \u00b7 Deployment and Admin Guide"
description: "Deploy MariaDB operator with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="MariaDB operator guide sections"><a href="/user-guide/mariadb-operator/">Overview and User Guide</a><a href="/infrastructure/mariadb-operator/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/mariadb-operator/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/mariadb-operator/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Set `MARIADB_OPERATOR_CHART_VERSION`. Reconcile `mariadb-operator-crds` before `mariadb-operator`.

2. Prepare OpenEBS, the SuiteCRM PVC declarations, and the third failure domain before creating the managed database.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application mariadb-operator

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n mariadb-system get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

There is no browser OIDC configuration for this operator. Kubernetes RBAC controls database declarations, while MariaDB users and sealed passwords control SQL access. SuiteCRM’s SAML login is an independent layer.

## 4. Connect and operate the service

1. Confirm the CRDs and webhook are available before allowing SuiteCRM database reconciliation.

2. Review backup schedule, S3 access, and Galera recovery against the pinned operator version’s official documentation.

## 5. Maintain and recover

The operator installation is reconstructable. MariaDB data, physical backups, root/application credentials, and S3 credentials belong to SuiteCRM’s recovery set. The arbitrator stores no recoverable application database.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

Webhook errors can block new resources even when SQL remains available. For Galera failures, distinguish operator reconciliation from quorum, state transfer, image compatibility, and volume ownership problems.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/mariadb-operator/app.yaml)

[Official MariaDB operator documentation](https://github.com/mariadb-operator/mariadb-operator).
