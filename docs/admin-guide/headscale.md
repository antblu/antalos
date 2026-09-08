---
title: "Headscale and Headplane \u00b7 Deployment and Admin Guide"
description: "Deploy Headscale and Headplane with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="Headscale and Headplane guide sections"><a href="/user-guide/headscale/">Overview and User Guide</a><a href="/infrastructure/headscale/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/headscale/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/headscale/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Set the `HEADSCALE_*` and `HEADPLANE_*` variables, including DNS, issuer, allowed email domain, and storage.

2. Prepare the NFS export and reseal `headscale-oidc` plus `headplane`; the first includes both the OIDC client secret and the Headscale API credential used by Headplane.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application headscale

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n headscale get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

Both applications share the configured Authentik OIDC client. Register Headscale’s `/oidc/callback` and Headplane’s `/admin/oidc/callback` as exact HTTPS redirect URIs on that provider. Match PKCE and the configured `client_secret_basic` token authentication method. Headplane disables API-key browser login and defaults new OIDC users to `member`; establish an explicit administrator assignment using the Headplane version’s role-management procedure. Do not confuse its backend API credential with a user login method.

## 4. Connect and operate the service

1. Generate an appropriate Headscale API key through the administrator workflow and seal it into the referenced Secret. Rotate the key before it expires.

2. Test client enrollment, private DNS, an allowed connection, and a denied connection. Test Headplane with a non-admin identity.

3. Rehearse restore of both databases and retain out-of-band cluster access before changing the network policy or identity provider.

## 5. Maintain and recover

Preserve both Litestream backup directories, Headscale configuration and key material included in the storage arrangement, the Headplane cookie secret, and sealed OIDC/API credentials. A surviving backup is needed when the disposable SQLite volume is recreated.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

If Headscale will not start, check issuer discovery and NFS restore first. If the VPN works but Headplane fails, check its backend API key and separate database. A policy denying a connection can be correct behavior even when both services are healthy.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/certificate.yaml)
- [`config.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/config.yaml)
- [`headplane-config.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/headplane-config.yaml)
- [`headplane-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/headplane-secret.yaml)
- [`headplane.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/headplane.yaml)
- [`headscale.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/headscale.yaml)
- [`oidc-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/oidc-secret.yaml)
- [`storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/storage.yaml)

[Official Headscale and Headplane documentation](https://headscale.net/stable/).

[Headplane SSO and role mapping](https://headplane.net/features/sso) documents the callback and backend API-key requirements.
