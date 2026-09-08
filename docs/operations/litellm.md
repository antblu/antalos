---
title: LiteLLM gateway
description: LiteLLM deployment, Redis quorum, PostgreSQL failover, and initial administration.
---

## Deployment layout

`apps/litellm` contains the complete service, including its PostgreSQL cluster, Redis, sealed credentials, migration job, ingress, and certificate. Argo CD discovers `app.yaml` through the existing root application and renders the other YAML files with `yaml-envsubst`. Versions, endpoints, node names, and persistent volume sizes come from `apps/variables.yaml`.

| Component | Placement | Availability |
| --- | --- | --- |
| LiteLLM proxy | Two replicas, one per main worker | Required pod anti-affinity, rolling updates with `maxSurge: 0` and `maxUnavailable: 1`, and a disruption budget retaining one replica. |
| PostgreSQL | Two CloudNativePG instances, one per main worker | Primary and standby with separate OpenEBS volumes; CNPG promotes the survivor and maintains the read/write service. CNPG manages database disruption budgets. |
| Redis data | Two persistent members, one per main worker | One primary and one replica, each with a Sentinel sidecar. Redis configuration, AOF, and Sentinel state persist on the member's volume. |
| Redis quorum | One Sentinel on the RTX worker | The `quorum` / `Exists` / `NoSchedule` toleration permits scheduling. Together the three voters use quorum two. A shared Sentinel disruption budget retains two voters. |

LiteLLM uses authenticated Sentinel discovery for coordination and the shared authentication cache. Both data-side Sentinels and the RTX endpoint are configured, so losing RTX does not remove the application's Redis access path. Response caching is not enabled. One process runs in each proxy pod.

On restart, each Redis member discovers the primary from reachable Sentinels before starting. If none is reachable, it retains the role saved in its writable Redis configuration. Sentinel persists its topology on the data members; the disposable RTX voter discovers the topology from its peers when recreated.

## Reconciliation order

Publish the repository changes through the normal Git workflow. A local, uncommitted directory is not visible to Argo CD. Do not apply these files literally with unresolved `${VARIABLE_NAME}` placeholders.

The application uses these sync waves:

1. `-5`: Sealed Secrets, including the database owner credential.
2. `-3`: CloudNativePG cluster and database bootstrap.
3. `-1`: Redis, Sentinels, and the LiteLLM configuration.
4. `1`: A single `Sync` hook runs the upstream Prisma migration entrypoint. Migration failure blocks the rollout.
5. `2`: The two LiteLLM replicas start with schema updates disabled.

The migration uses a `Sync` hook rather than `PreSync` so a fresh installation can create its database and credentials first. `BeforeHookCreation` recreates the job for subsequent syncs. Failed migration jobs remain available for troubleshooting.

The certificate uses `letsencrypt-prod`; Traefik routes HTTPS for `LITELLM_HOST`. DNS must resolve that hostname to the existing ingress address. The default endpoint is `https://litellm.antblu.net`, with administration under `/ui` and the OpenAI-compatible API under `/v1`.

## Initial administration

Credentials were generated independently and encrypted using the cluster's Sealed Secrets certificate. No plaintext credential files are required.

| Kubernetes Secret | Keys and purpose |
| --- | --- |
| `litellm-app` | `ui-username` and `ui-password` for the admin UI; `master-key` for privileged API access; `salt-key` for encryption of stored provider credentials. |
| `litellm-db-app` | `username` and `password` for PostgreSQL. |
| `litellm-redis` | `password` for Redis clients, replication, and Sentinel authentication. |

Retrieve the admin credentials through your approved Kubernetes Secret access workflow in namespace `litellm`. Keep the master key restricted to administration; create virtual keys for applications.

No model providers or upstream API keys are preconfigured. Add provider credentials and models in the admin UI after deployment; `STORE_MODEL_IN_DB` makes these available to both replicas. Preserve the salt key during upgrades and recovery so existing encrypted provider credentials remain readable. Configuration changes to the mounted ConfigMap require restarting the application pods to reload startup settings.

## Failure and recovery boundaries

A single main-worker failure leaves one proxy, one database instance, one Redis data member, and two Sentinel voters. Database promotion and Redis election can briefly interrupt requests; in-flight streaming requests are not transferred between pods. Required node affinity keeps replacement data members on the two main workers, so full redundancy returns when the failed worker is restored.

PostgreSQL uses preferred synchronous durability: it requests acknowledgement from the standby while available, but prioritizes continued writes when no standby is available. Redis replication is asynchronous. This design tolerates a single node failure with a failover interval; it does not promise zero data loss through every failure sequence or network partition.

OpenEBS volumes are node-local. Replication is not a backup, and this deployment does not configure off-cluster database backups. Recovery after losing both data workers requires an independently maintained PostgreSQL backup and the original sealed credentials. Shared ingress, DNS, the Kubernetes API, the CNPG operator, and upstream model providers remain dependencies.

## Upstream references

- [LiteLLM production guidance](https://docs.litellm.ai/docs/proxy/prod)
- [LiteLLM Sentinel configuration](https://docs.litellm.ai/docs/proxy/caching#redis-sentinel)
- [LiteLLM release used by this deployment](https://github.com/BerriAI/litellm/releases/tag/v1.100.0)
- [Upstream migration job](https://github.com/BerriAI/litellm/blob/v1.100.0/helm/litellm-helm/templates/migrations-job.yaml)
- [Redis Sentinel topology and failover](https://redis.io/docs/latest/operate/oss_and_stack/management/sentinel/)
