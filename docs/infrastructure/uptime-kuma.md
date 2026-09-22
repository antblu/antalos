---
title: Uptime Kuma · Architecture
description: Understand the single monitoring process and its Litestream-backed SQLite recovery.
---

<nav class="guide-switcher" aria-label="Uptime Kuma guides"><a href="/user-guide/uptime-kuma/">Use</a><a aria-current="page" href="/infrastructure/uptime-kuma/">Architecture</a><a href="/admin-guide/uptime-kuma/">Operate</a></nav>

Uptime Kuma runs as one Deployment replica. Its live SQLite database is in pod-local storage; a Litestream sidecar copies database state to an NFS-backed backup volume. Replacement starts with a restore attempt before the application runs.

## Components and state

| Component | Declared behavior |
| --- | --- |
| Application | One replica serving on container port 3001 |
| Live data | `/app/data` in an `emptyDir` volume |
| Database | `/app/data/kuma.db` |
| Restore | Init container restores only when the database is absent and a replica exists |
| Continuous copy | Litestream native sidecar writes the configured backup |
| Durable backup mount | `uptime-kuma-backup` claim from `storage.yaml` |
| Ingress | `UPTIME_KUMA_HOST` with `uptime-kuma-tls` |

## Availability and failure behavior

**A recoverable singleton, without a hot serving replica.** Replacement interrupts checks and the UI while a new process restores and starts. The rollout permits the one application replica to be unavailable. A `minAvailable: 1` PDB can block voluntary eviction; it does not turn the workload into an HA monitor.

If the backup is absent, the restore flags allow startup to continue. A reachable new instance therefore does not prove monitor definitions and history were recovered. Litestream protects the configured SQLite database, not automatically every non-database file written under `/app/data`.

The monitor is inside the same cluster it observes. Cluster, ingress, or external-storage failure can remove both the service and its monitoring view. An independent external monitor is required to observe those failures from outside this failure domain.

## Ownership

`apps/uptime-kuma/` declares the workload, storage, Litestream configuration, and certificate. `UPTIME_KUMA_*` values belong in application variables. Monitors, notification targets, and status-page definitions are application state created after deployment.

See [administration](/admin-guide/uptime-kuma/) and the [upstream wiki](https://github.com/louislam/uptime-kuma/wiki).
