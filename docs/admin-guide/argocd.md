---
title: "Argo CD · Operate"
description: "Deploy Argo CD with antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="Argo CD guide sections"><a href="/user-guide/argocd/">Use</a><a href="/infrastructure/argocd/">Architecture</a><a aria-current="page" href="/admin-guide/argocd/">Operate</a></nav>

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

Argo CD uses native OIDC with the Authentik issuer `/application/o/argo-cd/`; Dex is disabled. Create the matching Authentik provider, register the Argo HTTPS `/auth/callback` URI, and match the client ID in `apps/argocd/app.yaml`. The existing sealed `dex.authentik.clientSecret` key in `argocd-secret` is reused despite its historical name. Retain the provider signing key and include effective `groups` in the ID token through its `profile` mapping. Configure Argo RBAC deliberately; an authenticated identity is not automatically authorized to manage applications.

### Migrate an existing Dex integration

1. Publish and reconcile the CloudNativePG operator and Authentik changes first. Confirm two operator replicas on separate nodes and a healthy database primary/standby before planned maintenance. The worker's startup reconciler uses `ARGOCD_AUTH_HOST` to add the strict `/auth/callback` redirect to the existing provider, retaining its credentials and previous callbacks.
2. Confirm that callback is present in the Authentik provider before reconciling `argocd-self` with native OIDC and Dex disabled. Keep independent kubeconfig/local administrator access during the transition. Existing Dex-issued sessions may require a fresh login.
3. Verify a new browser login, both read-only and administrator group permissions, and logout. If CLI SSO is needed, configure its exact loopback callback separately in the provider and test that flow.
4. For rollback, restore the preceding Dex configuration. Its callback and sealed credential remain available; do not rotate them as part of this migration.

The native integration follows [Argo CD's existing OIDC provider configuration](https://argo-cd.readthedocs.io/en/stable/operator-manual/user-management/#existing-oidc-provider).

## 4. Connect and operate the service

1. Point repository URLs and tracked revisions at your fork throughout bootstrap and Application sources.

2. Confirm root discovery and plugin substitution before adding more applications. Keep variables needed by Helm in rendered Application parameters or valuesObject.

3. Test a read-only identity and preserve independent kubeconfig access for recovery.

## Availability before maintenance

**Partially HA overall: replicated API/rendering and Redis HA design; reconciliation and SSO are not proven by those counts.**

Server/repo-server/proxy overrides use zero surge and one unavailable. Plugin subPath changes require repo-server replacement. Confirm chart-derived auxiliary replica and PDB behavior before promising seamless upgrades.

The API servers retain two replicas with hard hostname anti-affinity and a one-available PDB. General Argo components do not tolerate the quorum taint. Only the assigned Redis voters retain that access; two Redis proxies are explicitly restricted to the general workers. Native OIDC removes the Dex singleton; Authentik and its database remain dependencies.

After deployment, confirm placement and spare CPU, memory, and pod slots before a failure drill. Test loss of each main worker separately, including the one hosting the Authentik database primary. Record a new browser login and an Argo API request after endpoint removal and any database promotion. A PDB protects voluntary eviction only. A failed in-progress request may need a retry. Dynamic controller distribution enables takeover after missed heartbeats, using the pinned chart’s upstream alpha feature. Enabling it replaces the application-controller StatefulSet with a Deployment; inspect the rendered diff, preserve independent administrator access, and confirm the old controller is retired. Then verify a harmless Git reconciliation through the surviving controller. The optional Talos API VIP addresses the separate external API endpoint dependency.

Use the [component-by-component failure contract](/infrastructure/argocd/#availability-and-failure-behavior) before a node drain, database promotion, or upgrade. Restoring a healthy replica count must include data resynchronization and restored voting capacity, not just Running pods.

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

### Redis proxy restart failures

If an Argo Redis HAProxy restarts with exit 137, inspect Talos OOM-controller logs as well as Kubernetes container termination reasons. A host memory-pressure kill can appear as `Error` rather than `OOMKilled`. The Helm values reserve CPU/memory for HAProxy, cap its memory, and bound it to 1024 connections. Keep general application processes off the small quorum worker and check actual VM memory headroom; increasing pod limits does not increase RAM.

### Controller-kind migration safety

`argocd-self` sets `PruneLast=true` so a controller StatefulSet-to-Deployment migration does not delete the reconciler before its replacement is healthy. Publish this guard in a separate sync before changing controller kind on an existing installation. See [Argo CD prune-last behavior](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-options/#prune-last).

If an earlier migration has already removed every application controller, the UI can remain healthy while reconciliation stops. Restore only the missing application-controller Deployment from the pinned chart rendered with the committed values and the Application's Helm parameters. Review it, confirm its ServiceAccount/RBAC remain present, validate it with server dry-run, and apply that resolved Deployment. Do not apply unrelated chart Secrets or rotate credentials. Verify two ready controllers, dynamic shard assignment, and resumed child-Application reconciliation before attempting a failure drill.
