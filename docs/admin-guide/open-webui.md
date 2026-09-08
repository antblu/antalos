---
title: "Open WebUI \u00b7 Deployment and Admin Guide"
description: "Deploy Open WebUI with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="Open WebUI guide sections"><a href="/user-guide/open-webui/">Overview and User Guide</a><a href="/infrastructure/open-webui/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/open-webui/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/open-webui/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Set `OPEN_WEBUI_*` variables, including the discovery URL, client ID, database address, and S3 bucket. Prepare CNPG with the required vector image, OpenEBS, and Garage access.

2. Reseal `open-webui-oidc`, `open-webui-db-app`, `open-webui-redis`, and `open-webui-app`. Preserve the database URL format and the shared application key.

3. Let the database migration complete before opening the application to users. Plan downtime for the configured Recreate update strategy.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application open-webui

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n open-webui get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

Native OIDC uses `OPEN_WEBUI_OIDC_PROVIDER_URL`, `OPEN_WEBUI_OIDC_CLIENT_ID`, and `open-webui-oidc/oauth-client-secret`. Register the exact HTTPS `/oauth/oidc/callback` URI with Authentik. Match the discovery document’s issuer and bind the intended group. Inspect the manifest’s OAuth signup and email-account-merging settings before onboarding existing accounts; test with a new ordinary identity before changing administrator access.

## 4. Connect and operate the service

1. Configure a model connection in the administrator UI. For LiteLLM, use its `/v1` endpoint and a scoped virtual key, then select the allowed model aliases.

2. Assign user roles and model permissions explicitly. Verify chat, streaming, a file upload, retrieval, and sign-out/re-entry.

3. Define backups for chat history and objects and retain the same encryption key during restores.

## Availability before maintenance

**Partially HA: steady-state replicas exist, but Recreate upgrades and Redis/storage dependencies can interrupt all users.**

The chart explicitly uses Recreate. A version rollout may terminate both application replicas before starting their replacements; the application PDB does not turn a controller-driven Recreate update into a rolling one.

Document an upgrade outage unless a supported rolling/migration design is implemented. Establish Redis restart/rejoin correctness, durable backups, and a chat/upload test after failover. Keep the shared application secret identical across replicas and recovery.

Use the [component-by-component failure contract](/infrastructure/open-webui/#availability-and-failure-behavior) before a node drain, database promotion, or upgrade. Restoring a healthy replica count must include data resynchronization and restored voting capacity, not just Running pods.

## 5. Maintain and recover

Back up PostgreSQL and the Garage bucket together. Preserve the shared `webui-secret-key` across both replicas and recovery, as well as the OIDC and provider credentials. Local application storage is not the authoritative chat or upload database.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

If browser login succeeds but callbacks fail, compare the OIDC redirect and discovery URL. If uploads fail, inspect S3 access. If streams or replicas disagree, inspect Redis Sentinel authentication and the shared application key before increasing replicas.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/app.yaml)
- [`availability.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/availability.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/database.yaml)
- [`migration.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/migration.yaml)
- [`redis.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/redis.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/secrets.yaml)

[Official Open WebUI documentation](https://docs.openwebui.com/).
