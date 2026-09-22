---
title: "Invoice Ninja · Operate"
description: "Deploy and verify Invoice Ninja, its background jobs, PDFs, storage, and SMTP integration."
---

Invoice Ninja is owned by `apps/invoiceninja/`. Shared hostnames, image versions,
and storage sizes live in `apps/variables.yaml`; infrastructure credentials are
sealed in the application's manifest tree. Configure company email in Invoice Ninja's UI. Follow the
[application deployment workflow](/admin-guide/deploy-an-application/) to publish
changes to the branch tracked by Argo CD. Local edits are not deployment inputs.

## Deployment and dependencies

The local Helm chart deploys two PHP application replicas and two nginx replicas.
The supporting manifests provide two queue workers, a minute-by-minute scheduler,
two MariaDB Galera data members with a separate arbitrator, and Redis with Sentinel.
Application files use the configured Garage S3 bucket. Local application volumes
are ephemeral; they are not backups. Replication does not establish a tested
recovery procedure or prove failure tolerance for the full service.

The Application explicitly supplies both the Ingress hostname and its `/` Prefix
path. Helm parameters that set an array element can replace chart-default array
content; supplying only `ingress.hosts[0].host` can render an invalid Ingress with
no paths and block subsequent sync waves.

Workers and the scheduler invoke `/usr/local/bin/init.sh` before `runuser` and
their Artisan command. This preserves the image's architecture-specific Chrome
path for SnapPDF. These commands do not request the supervisor startup branch,
so they do not run the web container's migration and initialization sequence.

## Verify a deployment

From the repository root:

```bash
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application invoiceninja
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n invoiceninja get pods,deployments,statefulsets,cronjobs,jobs,pvc,certificate
```

Check Argo's operation result and resource drift separately from pod readiness.
The public `/health` endpoint returns a fixed API response; it does not test the
database, mail delivery, PDFs, or object storage.

Verify authenticated login and API reads, pending migrations, Galera primary
component membership and synchronization, Redis queue depth and failed jobs,
recent scheduler completion, and actual worker job completion. Test PDF rendering
in both web and worker processes using the application's configured PDF engine.
An explicitly overridden Chrome path can hide a broken worker configuration.

Test S3 writes and reads with a unique diagnostic object and remove only that
object afterward. Fetch the frontend assets as well as the landing page. A full
acceptance test also needs an authorized disposable invoice, client portal access,
PDF download, and any configured payment gateway's sandbox workflow.

## Mail and payment setup

Configure the company's SMTP provider, host, port, encryption, credentials, and
sender under **Settings → Email Settings** in Invoice Ninja. Select the SMTP
provider instead of Default to use the company's configuration. The repository
does not supply `MAIL_*` environment variables or a sealed SMTP password.
See the official [Invoice Ninja configuration reference](https://invoiceninja.github.io/docs/self-host/env-variables).

When removing an existing environment-based mail configuration, publish and
reconcile the changes, then roll the web and worker Deployments so their processes
and cached configuration no longer retain the old settings. Subsequent scheduler
Jobs inherit the updated configuration. Existing company settings remain in the
database; this source change does not populate or clear them.

SMTP connection and authentication tests can run without sending a message.
Delivery requires a separately authorized test recipient and evidence of receipt,
not merely acceptance into a queue. If Stalwart reports
`Unsupported credentials type for OIDC backend`, its selected authentication
backend cannot handle the submitted password. Use a supported service-account
authentication arrangement; do not change shared mail authentication merely to
clear an Invoice Ninja check. See [Stalwart's OIDC documentation](https://www.stalw.art/docs/auth/backend/oidc/).

Configure the intended payment gateway and use its sandbox before testing payment
collection. An empty gateway list is not evidence of working payments.

## Recovery

Protect the MariaDB database, S3 bucket, and existing application encryption key
together. Preserve integration credentials. Establish and test independent backups
before relying on the service for billing; do not treat two database replicas as
a backup. Restoring requires compatible application code and database migrations.

## Diagnostic snapshot: 22 September 2026

Live checks found working HTTPS and frontend assets, authenticated API reads,
synchronized Galera membership, no failed jobs or queue backlog, completing
scheduler jobs, and successful S3 diagnostic write/read/cleanup. The account had
no clients, invoices, or payment gateways. No MariaDB operator Backup resources
were present in the namespace; external backups were not audited.

Argo initially reported an invalid Ingress with no paths. Worker PDF rendering
failed because the Chrome path was absent. Both corrections reached `main` in
commit `611eb77` through a concurrent update, then reconciled successfully after
an Argo refresh. The worker rollout completed, the scheduler completed with the
corrected startup command, and Argo reported Synced and Healthy. A graceful
`php artisan queue:restart` allowed old workers to exit during the rollout.
Both replacement workers rendered a valid diagnostic PDF using the Chrome path
from their running worker process environment.
SMTP authentication still failed with Stalwart's OIDC backend error.
No email was sent and no payment was attempted. Browser interaction,
invoice lifecycle, client portal transactions, failover, and restore remain outside
this diagnostic snapshot.
