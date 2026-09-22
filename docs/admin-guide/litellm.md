---
title: "LiteLLM · Operate"
description: "Deploy LiteLLM with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="LiteLLM guide sections"><a href="/user-guide/litellm/">Use</a><a href="/infrastructure/litellm/">Architecture</a><a aria-current="page" href="/admin-guide/litellm/">Operate</a></nav>

This runbook deploys the service from `apps/litellm/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Prepare CNPG, OpenEBS, ingress, and capacity for the RTX Sentinel. Set `LITELLM_*` variables.

2. Reseal `litellm-db-app`, `litellm-app`, `litellm-redis`, and `litellm-model-discovery`. The discovery Secret contains the API key used to read the configured OpenAI-compatible endpoint. Keep the master key restricted to administration and preserve the salt key across upgrades.

3. Respect the sync waves: Secrets at -5, database at -3, Redis/config at -1, a single migration Sync hook at 1, proxies at 2, then model discovery at 3 and 4. Do not turn on concurrent schema migration in the proxies.

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

1. Maintain the reusable `llama-cpp` and `speaches` provider credentials in LiteLLM. Their API bases and keys must match the corresponding discovery variables and sealed discovery keys.

2. The `litellm-model-discovery` and `litellm-speaches-model-discovery` CronJobs poll their respective upstream `/v1/models` endpoints every two minutes. For each previously unseen upstream ID they call LiteLLM's supported `POST /model/new` management API, use the final path component as the public name, and route the deployment as `openai/<upstream-id>` through the matching reusable credential. The complete upstream ID and source API base are retained in discovery metadata and form the reconciliation identity. Neither job updates or deletes existing models; this prevents a temporary upstream outage or a naming collision from destroying manually managed configuration.

3. Create a limited virtual key for Open WebUI or another consumer and run a small request with it.

4. Establish a PostgreSQL backup and restore procedure. Restart proxies after changing mounted startup configuration that is not dynamically reloaded.

## Availability before maintenance

**HA design for a single data-worker loss, conditional on healthy control-plane, Sentinel communication, and upstream providers.**

Proxy updates retain one pod. A single Sync hook runs the schema migration before new proxies start; migration failure intentionally blocks rollout. Backward-incompatible schema changes may still require a maintenance window.

Record a real API request during primary loss, verify returned-member roles and all Sentinel peer connections, and establish a database backup with the original salt key. Provider/network availability needs its own assessment.

Use the [component-by-component failure contract](/infrastructure/litellm/#availability-and-failure-behavior) before a node drain, database promotion, or upgrade. Restoring a healthy replica count must include data resynchronization and restored voting capacity, not just Running pods.

## 5. Maintain and recover

PostgreSQL stores model configuration, keys, and administration state. Preserve the original `litellm-app` salt key to decrypt stored provider credentials. Redis state is asynchronous; the configuration does not declare an off-cluster PostgreSQL backup.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

If rollout is blocked, inspect `litellm-migrations` before the proxy logs. A Redis `MasterNotFoundError` requires checking all Sentinel endpoints and authentication. A working UI with failing requests usually needs model/provider, permission, quota, or upstream investigation.

For discovery failures, inspect the latest Job created by `litellm-model-discovery` or `litellm-speaches-model-discovery`. The shared controller fails closed when an upstream response is malformed, when either endpoint is unavailable, or when the running LiteLLM OpenAPI schema no longer advertises `GET /v2/model/info` and `POST /model/new`. Existing LiteLLM models remain untouched. A model-name collision is intentionally treated as already managed; resolve the conflicting deployment manually if its route is wrong.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/app.yaml)
- [`availability.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/availability.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/certificate.yaml)
- [`config.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/config.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/database.yaml)
- [`deployment.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/deployment.yaml)
- [`migration.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/migration.yaml)
- [`model-discovery.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/model-discovery.yaml)
- [`redis.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/redis.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/litellm/secrets.yaml)

[Official LiteLLM documentation](https://docs.litellm.ai/docs/).
