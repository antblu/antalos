---
title: Activepieces · Architecture
description: Understand application workers, PostgreSQL, Redis Sentinel, object storage, and failure boundaries.
---

<nav class="guide-switcher" aria-label="Activepieces guides"><a href="/user-guide/activepieces/">Use</a><a aria-current="page" href="/infrastructure/activepieces/">Architecture</a><a href="/admin-guide/activepieces/">Operate</a></nav>

Antalos separates the HTTP application from flow execution. Two application replicas serve requests and four worker replicas execute jobs. PostgreSQL holds application state, Redis coordinates queued work, and Garage stores files.

## Component layout

| Component | Declared layout | Responsibility |
| --- | --- | --- |
| Application | 2 replicas; required host anti-affinity on the main workers | UI, API, and incoming requests |
| Workers | 4 replicas; preferred host anti-affinity on the main workers | Execute flows with per-worker concurrency set to one |
| PostgreSQL | 2 CNPG instances on separate main workers | Application state; preferred synchronous policy |
| Redis | 2 persistent data members and 3 Sentinel voters | Queue/coordination and direct Sentinel primary discovery |
| Third Sentinel | RTX worker | Election vote, without another queue dataset |
| Garage | External S3 bucket | Files used by the application |

Worker spreading is a preference. The application replica placement is a hard requirement. Neither proves how many ready workers remain during a physical-host loss without checking actual placement and capacity.

## Availability and failure behavior

**Replicated application and data tiers, with external-service and job-execution limits.** A surviving HTTP replica can accept requests when PostgreSQL, Redis, and object storage are usable. A failed database primary or Redis master introduces its own promotion and reconnection interval.

The Redis startup scripts query Sentinels and retain topology state. The third voter helps election; it does not hold queued data. A worker lost during an external action can leave the action's result uncertain. Review run state and the connected system before replaying work.

Loss of Garage, an integration credential, or an upstream API can stop a flow while the Activepieces UI remains available. Whole-host failure also includes the [shared API and physical placement limits](/infrastructure/availability/).

## State and recovery

Recover PostgreSQL, relevant Garage objects, original application encryption/authentication secrets, and configuration together. Include queue handling in the recovery plan; re-running every historical or pending action is not a general restore procedure. Read the supported upgrade procedure for the selected image before changing schema versions.

## Source and upstream documentation

`apps/activepieces/app.yaml` selects the manifest renderer. `activepieces.yaml` defines the app and workers; `database.yaml`, `redis.yaml`, `config.yaml`, and `secrets.yaml` define their dependencies. `ACTIVEPIECES_*` inputs belong in `apps/variables.yaml`.

See the [Activepieces installation documentation](https://www.activepieces.com/docs/install/overview) for supported deployment choices. This repository supplies its own Kubernetes layout, so the upstream quick-install command is not the Antalos deployment procedure.
