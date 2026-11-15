---
title: "MariaDB operator · Operate"
description: "Install the MariaDB operator and check application database readiness."
---

<nav class="guide-switcher" aria-label="MariaDB operator guide sections"><a href="/user-guide/mariadb-operator/">Use</a><a href="/infrastructure/mariadb-operator/">Architecture</a><a aria-current="page" href="/admin-guide/mariadb-operator/">Operate</a></nav>

Use `apps/mariadb-operator/` with the [shared deployment workflow](/admin-guide/deploy-an-application/) to render manifests, prepare credentials, and reconcile the Application.

## 1. Prepare dependencies and inputs

1. Set `MARIADB_OPERATOR_CHART_VERSION`. Reconcile `mariadb-operator-crds` before `mariadb-operator`.

2. Prepare OpenEBS, the SuiteCRM PVC declarations, and the third failure domain before creating the managed database.

## 2. Reconcile the application

Push the reviewed manifests and variables to the branch Argo CD tracks. Let the root app-of-apps discover the Application and run its hooks in order. Keep unresolved templates out of direct Kubernetes applies.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application mariadb-operator

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n mariadb-system get pods,svc,pvc
```

Confirm the expected Git revision synced and the required workloads are ready. Then test the service.

## 3. Complete identity and first access

There is no browser OIDC configuration for this operator. Kubernetes RBAC controls database declarations, while MariaDB users and sealed passwords control SQL access. SuiteCRM’s SAML login is an independent layer.

## 4. Connect and operate the service

1. Confirm the CRDs and webhook are available before allowing SuiteCRM database reconciliation.

2. Review backup schedule, S3 access, and Galera recovery against the pinned operator version’s official documentation.

## Availability before maintenance

**HA management design: replicated operator and webhook; database HA still belongs to each managed MariaDB.**

CRDs reconcile before the operator through waves -10 and -9. Management rollouts use zero surge and one unavailable; incompatible CRD/operator changes can still block reconciliation.

Record management/webhook continuity and Galera membership changes separately. Keep schema/CRD version compatibility and physical-backup restoration part of the database service contract.

Review [failure behavior](/infrastructure/mariadb-operator/#availability-and-failure-behavior) before maintenance.

## 5. Maintain and recover

The operator installation is reconstructable. MariaDB data, physical backups, root/application credentials, and S3 credentials belong to SuiteCRM’s recovery set. The arbitrator stores no recoverable application database.

Read the target version’s release notes and record a recovery point before upgrading. See [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/).

## Troubleshooting

Webhook errors can block new resources even when SQL remains available. For Galera failures, distinguish operator reconciliation from quorum, state transfer, image compatibility, and volume ownership problems.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/mariadb-operator/app.yaml)

[Official MariaDB operator documentation](https://github.com/mariadb-operator/mariadb-operator).
