---
title: "Vaultwarden \u00b7 Deployment and Admin Guide"
description: "Deploy Vaultwarden with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="Vaultwarden guide sections"><a href="/user-guide/vaultwarden/">Overview and User Guide</a><a href="/infrastructure/vaultwarden/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/vaultwarden/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/vaultwarden/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Prepare CNPG, OpenEBS, NFS CSI, ingress, and cert-manager. Set `VAULTWARDEN_*` variables.

2. Prepare the NFS data export and reseal `vaultwarden-db-app` and `vaultwarden-admin`. Use the administrator-token format recommended by the deployed version.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application vaultwarden

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n vaultwarden get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

The manifests do not configure OIDC. Use the token in `vaultwarden-admin` to access `/admin`, then invite the initial account because public signup is disabled. SMTP is not configured, so follow the upstream invitation workflow for a server without mail or finish SMTP first. Avoid an interactive forward-auth layer on the vault API: native clients need direct access to the application’s own authentication endpoints.

## 4. Connect and operate the service

1. Complete invitation policy, account recovery expectations, SMTP, and organization roles. Keep the administrator token separate from user master passwords.

2. Test browser and native-client sign-in, synchronization, and an attachment upload/download.

3. Define and rehearse a coordinated PostgreSQL and NFS backup. Accept a brief application outage for Recreate updates.

## Availability before maintenance

**Not HA at the application layer: one vault server; PostgreSQL alone is replicated.**

Recreate removes the application process during upgrades. Running two database instances does not make that deployment strategy zero downtime.

Define the accepted synchronization outage and rehearse a database-plus-/data restore. Continuous vault-server HA would need a supported multi-instance application and shared-state design rather than a replica-count edit alone.

Use the [component-by-component failure contract](/infrastructure/vaultwarden/#availability-and-failure-behavior) before a node drain, database promotion, or upgrade. Restoring a healthy replica count must include data resynchronization and restored voting capacity, not just Running pods.

## 5. Maintain and recover

Preserve PostgreSQL, the NFS data directory, the administrator token, and database credentials. Attachments and other `/data` state must accompany the database backup. The original deployment’s data and keys must remain consistent during recovery.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

If a native client cannot log in, confirm its custom server URL and TLS trust. Missing invitations may be expected while SMTP is absent. For failed attachment operations, inspect the NFS mount separately from PostgreSQL readiness.

## Manifest and upstream reference

- [`admin-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/admin-secret.yaml)
- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/database.yaml)
- [`db-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/db-secret.yaml)
- [`storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/storage.yaml)

[Official Vaultwarden documentation](https://github.com/dani-garcia/vaultwarden/wiki).
