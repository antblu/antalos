---
title: Uptime Kuma · Operate
description: Deploy monitoring, configure useful checks, and retain the SQLite state needed for recovery.
---

<nav class="guide-switcher" aria-label="Uptime Kuma guides"><a href="/user-guide/uptime-kuma/">Use</a><a href="/infrastructure/uptime-kuma/">Architecture</a><a aria-current="page" href="/admin-guide/uptime-kuma/">Operate</a></nav>

Use `apps/uptime-kuma/` for the deployment and the [official wiki](https://github.com/louislam/uptime-kuma/wiki) for application configuration. The Kubernetes manifests create the server, not your monitor inventory.

## Deploy and configure

1. Prepare the NFS backup export and permissions expected by `storage.yaml`; the pod uses UID/GID 1006.
2. Set `UPTIME_KUMA_*` inputs for the hostname, image, and storage limits. Review the certificate and ingress.
3. Reconcile the Application through the [shared workflow](/admin-guide/deploy-an-application/).
4. Establish the intended administrator account and recovery access through the installed version's setup.
5. Add monitors with the correct target, probe type, expected result, and interval.
6. Configure notification targets and publish only the intended monitor set on status pages.
7. Exercise an authorized notification test and confirm the recipient receives it.

## Choose checks that answer a question

| Probe goal | Interpretation |
| --- | --- |
| Public web endpoint | Tests the selected response from the monitor's network path |
| Internal Service | Tests an internal application path; can bypass the public edge |
| TCP port | Establishes a connection, without proving login or a full transaction |
| A workflow-specific result | Covers the defined workflow only, with its credentials and dependencies |

Avoid using only an in-cluster HTTP check to claim that an outside user can reach a service. Document where the monitor runs and what it tests.

## Maintenance and restore

The single replica stops checking during its restart. Account for that monitoring gap when maintaining the cluster. Its PDB can block a routine drain; follow the explicit restart/restore plan instead of assuming a second monitor is available.

Preserve the NFS Litestream backup and original application access. On restore, confirm the expected monitor definitions, history, status pages, and notification settings. Review other application files that might need separate backup; the SQLite replication configuration is not a backup of the entire data directory.

Use the [architecture guide](/infrastructure/uptime-kuma/) for these persistence limits, and [disaster recovery](/admin-guide/disaster-recovery/) for wider cluster recovery.
