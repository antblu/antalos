---
title: "Nextcloud \u00b7 Deployment and Admin Guide"
description: "Deploy Nextcloud with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="Nextcloud guide sections"><a href="/user-guide/nextcloud/">Overview and User Guide</a><a href="/infrastructure/nextcloud/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/nextcloud/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/nextcloud/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Prepare CNPG, OpenEBS, NFS CSI, Garage, Traefik, cert-manager, and the identity service. Set the Nextcloud and companion hostname/storage variables.

2. Create the Garage bucket and permissions before first install; this is primary object storage, not an ordinary external-files mount. Prepare the app export for UID/GID 33.

3. Reseal the main, companion, Context Chat, and Talk credentials. Preserve the original instance ID, secret, password salt, and storage credentials when recovering data.

4. Follow the [Nextcloud deployment details](/admin-guide/nextcloud-integrations/) for app configuration and [upgrade procedure](/admin-guide/nextcloud-upgrades/) for an existing installation.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application nextcloud

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n nextcloud get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

The repository installs `user_oidc`, but does not create its Authentik provider configuration for you. Add an OAuth2/OIDC provider in Authentik, bind the allowed group, and register the callback reported by the Nextcloud OIDC configuration. In Nextcloud administration, enter the client ID, client secret, discovery document, and stable user-ID mapping. Keep one working local administrator while verifying provisioning and existing-account linking. Do not assume that equal email addresses should merge accounts automatically.

## 4. Connect and operate the service

1. Finish the office JWT, Whiteboard, Context Chat, and Talk setup described in the integration guide; several values are reapplied by startup hooks.

2. Configure outbound mail, background-job scheduling, trusted domains/proxies, and allowed AI providers. Verify each feature with a non-admin account.

3. Upload, share, sync, and download a file; edit a document with two users; test a Talk call across networks. Establish a coordinated database/object backup before inviting users.

## 5. Maintain and recover

A recoverable Nextcloud installation needs the database, Garage objects, original secret/salt and credentials, Git configuration, and any NFS content that cannot be re-created. Pinned application code can be downloaded again, but Whiteboard recording files or manually installed extensions on shared storage need separate consideration. Redis locks and disposable pod files do not replace the data backup.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

For a 503 or incomplete rollout, separate database migration, app-code initialization, Redis discovery, and ingress failures. For missing files, verify database and object-store consistency before changing buckets. Read-only configuration requires the controlled maintenance procedure in the upgrade guide.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/app.yaml)
- [`availability.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/availability.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/certificate.yaml)
- [`companion-secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/companion-secrets.yaml)
- [`companion-services.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/companion-services.yaml)
- [`config.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/config.yaml)
- [`context-chat-backend.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/context-chat-backend.yaml)
- [`context-chat-secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/context-chat-secrets.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/database.yaml)
- [`metrics.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/metrics.yaml)
- [`redis.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/redis.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/secrets.yaml)
- [`security-headers.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/security-headers.yaml)
- [`storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/storage.yaml)
- [`talk-secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/talk-secrets.yaml)
- [`talk.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/talk.yaml)
- [`well-known.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/well-known.yaml)

[Official Nextcloud documentation](https://docs.nextcloud.com/server/latest/user_manual/en/).
