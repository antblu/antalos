---
title: Medusa · Architecture
description: Replicated Medusa backend and Admin with CNPG, Redis Sentinel, and Garage files.
---

<nav class="guide-switcher" aria-label="Medusa guides"><a href="/user-guide/medusa/">Use</a><a aria-current="page" href="/infrastructure/medusa/">Architecture</a><a href="/admin-guide/medusa/">Operate</a></nav>

## Components and ownership

`apps/medusa/` owns the backend, Admin dashboard, database, Redis, migration hook, TLS certificate, and sealed credentials. Shared inputs live in `apps/variables.yaml`. The backend image source lives in `apps/medusa/image/`; `.github/workflows/medusa-image.yaml` builds it. No Next.js storefront is included.

| Component | Design |
| --- | --- |
| HTTP API and Admin | Two server pods, required hostname anti-affinity across the left/right workers; Traefik routes `medusa.antblu.net` to ready Service endpoints. Admin is served under `/app`. |
| Admin identity | Authentik OIDC through the native `antid` provider, displayed as `antID`; Admin users authenticate only through that provider. Verified-email provisioning creates or links a Medusa user. Authentik application bindings define who may become an administrator. |
| Background processing | Two worker pods across the same workers; Redis coordinates workflows, events, scheduled work, caching, sessions, and distributed locks. Workers are not exposed by the HTTP Service. |
| PostgreSQL | Two CNPG instances on separate OpenEBS local volumes; streaming replication, `any / 1 / preferred` synchronous policy, operator promotion, and the `medusa-db-rw` writer Service. |
| Redis | Two data pods on separate local volumes, AOF persistence, no eviction, and a Sentinel sidecar on each. A third Sentinel-only voter runs on the RTX worker with the `quorum` toleration. Quorum is two. |
| Redis clients | Authenticated native Sentinel discovery in every Medusa Redis consumer, including sessions, cache, events, workflow pub/sub/queues, and locking. Promotion notifications force reconnection even if the old primary socket remains open. No singleton proxy. |
| OAuth state | The Auth module depends on the legacy `cache` interface, explicitly backed by `cache-redis` with the same Sentinel options. Modern caching remains configured separately. Both serving pods can read the login state; no sticky session is required. |
| Files | Existing Garage S3 endpoint, region `garage`, bucket `medusa`; path-style requests and no ACL header. Access credentials are namespace-scoped SealedSecrets. |

## Availability and recovery

The design targets a single left/right data-worker failure while the surviving worker, RTX voter, Kubernetes API, CNPG operator, ingress, and Garage remain available. PostgreSQL promotion and Redis election interrupt in-flight operations; clients must reconnect and callers may need to retry. Two PodDisruptionBudgets preserve one server and one worker during voluntary disruptions; Redis budgets preserve a data member and two voters. They do not prevent involuntary loss.

Redis replication is asynchronous, and AOF fsync runs every second. Recent sessions, queued work, cache entries, or locks may be lost on failure. Distributed locking does not provide exactly-once business operations across a Redis failover. CNPG's preferred synchronous policy permits writes without a standby during degradation, trading durability for availability. After a Redis primary returns, startup consults Sentinel and joins the elected primary; persistent role/configuration files survive container restarts.

Garage and the external ingress/DNS/network path remain shared dependencies. The third Sentinel is a voter, not a third data copy. A partitioned old writer must be fenced before manual recovery; replica count does not establish whole-host or end-to-end availability.

`MEDUSA_S3_FILE_URL` initially points to the existing internal Garage bucket path. It is not a public media delivery endpoint. Browser retrieval requires reachable URLs and bucket read policy; public storefront media delivery is deferred with the storefront. Do not make the bucket public implicitly.

Back up PostgreSQL, Garage objects, and the application JWT/cookie and integration credentials as a recovery set. Redis AOF is not a database backup. No scheduled database/object backup is introduced by these manifests. This page describes source design, not collected live health or a completed failover drill.

References: [Medusa production deployment](https://docs.medusajs.com/learn/deployment/general), [CNPG replication](https://cloudnative-pg.io/docs/1.28/replication/), [Redis Sentinel](https://redis.io/docs/latest/operate/oss_and_stack/management/sentinel/).
