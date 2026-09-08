---
title: "Rancher \u00b7 Deployment and Admin Guide"
description: "Deploy Rancher with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="Rancher guide sections"><a href="/user-guide/rancher/">Overview and User Guide</a><a href="/infrastructure/rancher/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/rancher/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/rancher/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Set `RANCHER_HOST` and `RANCHER_CHART_VERSION`; prepare DNS, ingress, and cert-manager.

2. Reconcile both `rancher` and `rancher-config`, since the chart and certificate have separate Application resources.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application rancher

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n cattle-system get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

The checked-in chart does not define an external authentication provider. Complete the first-login bootstrap using the chart’s bootstrap credential through a private Secret workflow, set the public server URL, and create administrator access. If adding Authentik, select a protocol supported by the pinned Rancher version and configure it in Rancher’s authentication settings using the callback or metadata that Rancher supplies. Keep local administrator access until group mapping is verified.

## 4. Connect and operate the service

1. Restrict user/project roles and test a read-only account before onboarding operators.

2. Inspect the local cluster and confirm that its agents and API connection are healthy.

3. Add a management-state backup and recovery procedure if Rancher-created resources are part of your operational recovery set.

## Availability before maintenance

**HA management web tier; it is not an independent control plane for recovering this cluster.**

The repository pins two replicas and required anti-affinity but does not explicitly declare a Rancher PDB or rollout strategy. Those details are chart-derived; do not claim the standard zero-surge/minimum-one contract from this Application alone.

Retain independent kubectl/Talos access, make chart-derived rollout/disruption settings explicit where needed, and measure both UI access and a real API-backed operation during one-server failure.

Use the [component-by-component failure contract](/infrastructure/rancher/#availability-and-failure-behavior) before a node drain, database promotion, or upgrade. Restoring a healthy replica count must include data resynchronization and restored voting capacity, not just Running pods.

## 5. Maintain and recover

Rancher management state lives in Kubernetes resources and secrets; recovery must account for that state as well as the Helm values. Preserve the platform recovery set and use upstream Rancher backup procedures where configured.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

When the UI is unavailable, use kubectl directly. Check both Argo Applications, the certificate, and the Rancher pods. Authentication success without cluster access usually points to authorization or agent connectivity rather than ingress.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/rancher/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/rancher/certificate.yaml)

[Official Rancher documentation](https://ranchermanager.docs.rancher.com/).
