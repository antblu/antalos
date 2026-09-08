---
title: "LiteLLM \u00b7 Deployment and Admin Guide"
description: "Deploy LiteLLM with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="LiteLLM guide sections"><a href="/user-guide/litellm/">Overview and User Guide</a><a href="/infrastructure/litellm/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/litellm/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/litellm/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Prepare CNPG, OpenEBS, ingress, and capacity for the RTX Sentinel. Set `LITELLM_*` variables.

2. Reseal `litellm-db-app`, `litellm-app`, and `litellm-redis`. Keep the master key restricted to administration and preserve the salt key across upgrades.

3. Respect the sync waves: Secrets at -5, database at -3, Redis/config at -1, a single migration Sync hook at 1, then proxies at 2. Do not turn on concurrent schema migration in the proxies.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application litellm

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n litellm get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

The checked-in deployment uses the credentials in `litellm-app` for its `/ui` administration page; it does not configure OIDC. Use `ui-username` and `ui-password` through private Secret access. If adding SSO later, follow LiteLLM’s documentation for the deployed edition and keep machine API requests able to authenticate with their virtual keys. An interactive ingress login must not intercept `/v1` API calls.

## 4. Connect and operate the service

1. Add provider credentials and model aliases in the UI; database-backed configuration makes them available to both replicas.

2. Create a limited virtual key for Open WebUI or another consumer and run a small request with it.

3. Establish a PostgreSQL backup and restore procedure. Restart proxies after changing mounted startup configuration that is not dynamically reloaded.

## 5. Maintain and recover

PostgreSQL stores model configuration, keys, and administration state. Preserve the original `litellm-app` salt key to decrypt stored provider credentials. Redis state is asynchronous; the configuration does not declare an off-cluster PostgreSQL backup.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

If rollout is blocked, inspect `litellm-migrations` before the proxy logs. A Redis `MasterNotFoundError` requires checking all Sentinel endpoints and authentication. A working UI with failing requests usually needs model/provider, permission, quota, or upstream investigation.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/app.yaml)
- [`availability.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/availability.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/certificate.yaml)
- [`config.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/config.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/database.yaml)
- [`deployment.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/deployment.yaml)
- [`migration.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/migration.yaml)
- [`redis.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/redis.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/secrets.yaml)

[Official LiteLLM documentation](https://docs.litellm.ai/docs/).
