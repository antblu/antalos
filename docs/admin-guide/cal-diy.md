---
title: Cal.diy administration
description: Deployment dependencies and functional acceptance checks.
---

Cal.diy is configured at `https://cal.antblu.net`. Manifests live in
`apps/cal-diy/`, shared settings in `apps/variables.yaml`, and image builds in
`.github/workflows/cal-diy-images.yaml`. The image workflow checks that pinned
PAtreju commit `64c8693b971c77361655dd36ce61371978ff1287` descends from
[upstream Cal.diy v6.2.0](https://github.com/calcom/cal.diy/releases/tag/v6.2.0)
(commit `1c193cca8682b33b9866c792186033f7ef886682`), then applies the local
OIDC fixes in `apps/cal-diy/source-patches/oidc-bootstrap.patch` before building.
The web deployment and database migration use `ghcr.io/antblu/cal.diy-oidc:OIDC`;
the API v2 deployment retains its published
`ghcr.io/antblu/cal-diy-api:oidc-64c8693b971c` image. The image workflow
publishes its web build to `ghcr.io/antblu/cal-diy-web`, separately from the
deployed web image.
SMTP is not configured in the current manifests.

## Deployment and capacity

Argo CD reconciles `main`; local changes must be published through the repository
workflow to affect deployment. Sync proceeds through secrets at wave -5,
the database operator's namespace-scoped Role bind permission at -4,
PostgreSQL at -3, configuration at -2, Redis at -1, the database migration
Sync hook at 0, web/API at 1, and the scheduler at 2. Keep migrations in Sync.

The Role and RoleBinding in `apps/cal-diy/cnpg-rbac.yaml` allow the CloudNativePG
operator service account to bind only the generated `cal-diy-db` Role in this
namespace. If the Cluster reports that it cannot create `cal-diy-db`'s
RoleBinding, verify this grant and the operator's service account before retrying
database reconciliation.

Each main worker currently reserves 850 millicores and 832 MiB for one
database, web, API, Redis/Sentinel, and Redis proxy replica. The RTX worker also
hosts a 25-millicore, 32-MiB Sentinel voter. Allow additional capacity for the
migration hook (250 millicores, 64 MiB) and scheduler (10 millicores, 32 MiB).
Required anti-affinity requires space on both main workers. The 32-MiB web and
API requests are an emergency capacity workaround: observed usage during recovery
was about 720 MiB per web pod and 680 MiB for an API pod. Expand worker capacity
and restore realistic requests before relying on these reservations for safe
rollouts or failure recovery.

The two CNPG instances use preferred synchronous durability. Redis has two data
members and three Sentinel voters. Availability still depends on capacity,
quorum, ingress, identity, and external integrations. No database backup
destination is configured in this application's Cluster manifest.

## Scheduled tasks

The scheduler invokes authenticated POST routes present in pinned commit
`64c8693b971c77361655dd36ce61371978ff1287`: `webhookTriggers` every minute,
`bookingReminder` every 15 minutes, `changeTimeZone` hourly, and `syncAppMeta`
monthly. Metadata sync stays in dry-run mode with `CRON_ENABLE_APP_SYNC=false`.
SMS, workflow, downgrade, and digest routes removed from this fork must not be
scheduled. The separate optional calendar-subscription GET routes are not
scheduled by the current manifest.

## Mail and integrations

Configure `EMAIL_FROM`, `EMAIL_FROM_NAME`, `EMAIL_SERVER_HOST`, and
`EMAIL_SERVER_PORT` before accepting email-dependent workflows. Store
`EMAIL_SERVER_USER` and `EMAIL_SERVER_PASSWORD` in a service-owned SealedSecret
and reference those keys from the workload. Use an authorized sender and verify
actual delivery, not just SMTP connectivity.

The OIDC redirect URI is `https://cal.antblu.net/api/auth/callback/oidc`.
The first Cal.diy administrator is the verified Authentik identity
`admin@antblu.net` (`CALDIY_OIDC_ADMIN_EMAIL`). With that value set, the login page
shows **Sign in with antID** even when the Cal.diy user table is empty. The
matching OIDC identity receives the first administrator role after successful
Authentik login; other OIDC users receive normal user roles. The password-based
first-run setup endpoint is disabled in this mode. The URL shown next to the
username field on the old setup form is a fixed prefix, not a username value.

The OIDC provider is added from runtime environment variables, so the client
secret stays out of the image build. Confirm that `/api/auth/providers` lists
`oidc` after rollout, then complete an Authentik login and check the resulting
Cal.diy user role. Preserve existing authentication and encryption secrets.
Calendar providers, payments, and conferencing need their own credentials and
user authorization.
Cal Video is intentionally disabled without `DAILY_API_KEY`.

## Acceptance checks

1. Verify published source, Argo sync completion, migrations, both CNPG instances,
   Redis replication/Sentinel, and all web/API replicas separately.
2. Verify public DNS, trusted TLS, login, API routing, and a complete Authentik
   login and return to Cal.diy; confirm the designated identity is an administrator.
3. With an authorized test account, connect the intended calendar, configure
   timezone and availability, and confirm busy events prevent conflicting bookings.
4. With permission to send test notifications, create, reschedule, and cancel a
   booking; verify persistence, calendar changes, and delivered email.
5. Check scheduled jobs across quarter-hour and hour boundaries. Test each
   enabled payment, video, webhook, or push integration separately.

### Live diagnostic snapshot: 22 September 2026

Argo was blocked at database wave -3. The first database instance ran on the
right worker; the second instance's join pod could not schedule on the left
worker due to insufficient CPU requests. Both workers had approximately 97%
of allocatable memory requested. Web/API workloads and service TLS had not
been created. Public HTTPS failed certificate verification; a diagnostic request
ignoring trust returned 404. This snapshot does not establish later health or
successful user transactions.

### Live diagnostic snapshot: 23 September 2026

Argo reported Synced and Healthy with two ready web pods, two ready API pods,
and two ready PostgreSQL instances. The Cal.diy database had zero users.
Public `/auth/login` redirected to `/auth/setup?step=1`, and
`/api/auth/providers` listed only `credentials` and `email`. These observations
precede publication of the OIDC bootstrap patch and do not establish a
successful OIDC login.
