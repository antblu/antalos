---
title: "Authentik \u00b7 Deployment and Admin Guide"
description: "Deploy Authentik with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="Authentik guide sections"><a href="/user-guide/authentik/">Overview and User Guide</a><a href="/infrastructure/authentik/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/authentik/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/authentik/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Prepare CloudNativePG, NFS CSI, ingress, DNS, and cert-manager before the application.

2. Set `AUTHENTIK_HOST`, the `AUTHENTIK_DATABASE_STORAGE_SIZE` and media variables, and the `AUTHENTIK_EMAIL_*` settings. Make the media export writable by the container identity specified in the chart.

3. Reseal `authentik-db-app`, `authentik-secrets`, and `authentik-email`. Keep the database password and chart Secret references consistent; preserve the application secret key when restoring an existing instance.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application authentik

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n authentik get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

On a new database, complete the upstream initial setup flow at `/if/flow/initial-setup/` and establish an administrator. Create one application/provider pair per relying application, bind the permitted users or groups, and copy the provider metadata into that app’s settings. Use the [SSO integration guide](/admin-guide/single-sign-on/) for the exact distinction between OIDC, SAML, and forward-auth. Provider objects are post-deployment configuration; the Kubernetes manifests alone do not create them.

## 4. Connect and operate the service

1. Configure and test outbound email before relying on password recovery. The declared SMTP endpoint is Stalwart, so retain a recovery path that does not depend on both services being healthy.

2. Test each new provider with an ordinary user and with an account that should be denied. Confirm the application grants the intended role.

3. For proxy applications, add the provider to the embedded outpost and create a callback route on the protected application hostname.

## 5. Maintain and recover

Back up PostgreSQL, the media export, and the original `AUTHENTIK_SECRET_KEY`. The database holds users, provider definitions, policy bindings, and flows. Restoring pods from Git does not recreate provider configuration stored in that database.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

If authentication loops, compare the requested callback URI with the provider allowlist, then check the issuer, signing keys, and server clock. If a protected hostname returns an outpost 404, inspect the host-specific outpost route and provider assignment before changing the protected application.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/certificate.yaml)
- [`db-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/db-secret.yaml)
- [`db.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/db.yaml)
- [`email-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/email-secret.yaml)
- [`media-pvc.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/media-pvc.yaml)
- [`metrics.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/metrics.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/secrets.yaml)

[Official Authentik documentation](https://docs.goauthentik.io/).
