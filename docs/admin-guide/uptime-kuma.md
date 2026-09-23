---
title: Uptime Kuma · Operate
description: Deploy monitoring, configure useful checks, and retain the SQLite state needed for recovery.
---

<nav class="guide-switcher" aria-label="Uptime Kuma guides"><a href="/user-guide/uptime-kuma/">Use</a><a href="/infrastructure/uptime-kuma/">Architecture</a><a aria-current="page" href="/admin-guide/uptime-kuma/">Operate</a></nav>

Use `apps/uptime-kuma/` for the deployment and the [official wiki](https://github.com/louislam/uptime-kuma/wiki) for application configuration. The Kubernetes manifests create the server, not your monitor inventory.

## Deploy and configure

1. Prepare the NFS backup export and permissions expected by `storage.yaml`; the pod uses UID/GID 1006.
2. Set `UPTIME_KUMA_HOST` to the public status hostname and `UPTIME_KUMA_ADMIN_HOST` to the administrator hostname. Review the image and storage inputs and the certificate covering both names.
3. In Authentik, create an application named **Uptime Kuma** with a **Proxy Provider** in **Forward auth (single application)** mode. Set **External host** to `https://uptime.antblu.net`, assign the application to the embedded outpost, and bind only the intended administrators through an access policy. No internal host, OIDC client, or scope mapping is needed for this mode.
4. Reconcile the Application through the [shared workflow](/admin-guide/deploy-an-application/) and ensure both hostnames resolve to the Traefik edge.
5. Open `https://uptime.antblu.net`, complete Authentik sign-in, and establish the initial Uptime Kuma administrator account. In **Settings → Security → Advanced**, select **Disable Auth** and confirm with the current Kuma password. Kuma 2.5.5 stores this setting in its SQLite database; it has no supported disable-auth environment variable. Preserve the existing account as a recovery path if application authentication is re-enabled.
6. Add monitors with the correct target, probe type, expected result, and interval. Configure notification targets.
7. Create and publish a Uptime Kuma status page containing only the intended public monitor set. In that page's settings sidebar, add `status.antblu.net` as a domain name. Kuma uses the request host to show that page at the public root.
8. Confirm that an unauthenticated browser sees the published page at `https://status.antblu.net`, cannot reach the dashboard or login API through that host, and is redirected to Authentik at `https://uptime.antblu.net`. Check the outpost callback, an allowed administrator, and a denied identity. Exercise an authorized notification test and confirm the recipient receives it.

The public Traefik route permits only the status page, its static files, and its published status API using GET or HEAD. Other paths on `status.antblu.net` have no route to Kuma. `network-policy.yaml` permits inbound pod traffic on port 3001 only from Traefik pods, so other cluster workloads cannot bypass forward auth through the Service or pod IP. Keep this policy in force before disabling Kuma authentication. Changes to Kuma's public page asset or API paths may require updating that allowlist.

After disabling Kuma authentication, Authentik's proxy provider and Traefik are the administrator access boundary. Kuma does not validate or log in with an Authentik token itself; the embedded outpost checks the browser session on each protected request. Verify that direct in-cluster access is denied, an allowed administrator reaches the dashboard without a second login, and an unauthenticated or denied browser cannot reach it.

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
