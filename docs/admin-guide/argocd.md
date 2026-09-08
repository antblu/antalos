---
title: "Argo CD \u00b7 Deployment and Admin Guide"
description: "Deploy Argo CD with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="Argo CD guide sections"><a href="/user-guide/argocd/">Overview and User Guide</a><a href="/infrastructure/argocd/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/argocd/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/argocd/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Follow [cluster bootstrap](/admin-guide/bootstrap/) for the initial OpenTofu installation and key restoration.

2. Set `ARGOCD_HOST`, chart version, and plugin revision. A plugin change mounted through subPath needs repo-server replacement to load the new content.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application argocd-self

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

Dex is configured for the Authentik issuer `/application/o/argo-cd/`. Create the matching Authentik provider, register the Argo HTTPS `/api/dex/callback` URI, and match the client ID in `apps/argocd/app.yaml`. Seal its secret under the referenced `dex.authentik.clientSecret` key in `argocd-secret`. Configure Argo RBAC deliberately; an authenticated identity is not automatically authorized to manage applications.

## 4. Connect and operate the service

1. Point repository URLs and tracked revisions at your fork throughout bootstrap and Application sources.

2. Confirm root discovery and plugin substitution before adding more applications. Keep variables needed by Helm in rendered Application parameters or valuesObject.

3. Test a read-only identity and preserve independent kubeconfig access for recovery.

## 5. Maintain and recover

Git reconstructs desired state. Preserve repository credentials, Argo authentication secrets, the sealing key, and bootstrap state. Redis is control-plane support state rather than a backup of application databases.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

For apparent stale health, inspect `argocd.argoproj.io/skip-reconcile`, operation state, and hook conditions. Remove a reconciliation pause only after understanding why it was set. A failed historical pod should not outweigh healthy current replicas in the incident conclusion.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/argocd/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/argocd/certificate.yaml)
- [`secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/argocd/secret.yaml)

[Official Argo CD documentation](https://argo-cd.readthedocs.io/en/stable/user-guide/).
