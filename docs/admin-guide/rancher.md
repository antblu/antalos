---
title: "Rancher · Operate"
description: "Deploy Rancher and verify cluster management access."
---

<nav class="guide-switcher" aria-label="Rancher guide sections"><a href="/user-guide/rancher/">Use</a><a href="/infrastructure/rancher/">Architecture</a><a aria-current="page" href="/admin-guide/rancher/">Operate</a></nav>

Use `apps/rancher/` with the [shared deployment workflow](/admin-guide/deploy-an-application/) to render manifests, prepare credentials, and reconcile the Application.

## 1. Prepare dependencies and inputs

1. Set `RANCHER_HOST` and `RANCHER_CHART_VERSION`; prepare DNS, ingress, and cert-manager.

2. Reconcile both `rancher` and `rancher-config`, since the chart and certificate have separate Application resources.

## 2. Reconcile the application

Push the reviewed manifests and variables to the branch Argo CD tracks. Let the root app-of-apps discover the Application and run its hooks in order. Keep unresolved templates out of direct Kubernetes applies.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application rancher

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n cattle-system get pods,svc,pvc
```

Confirm the expected Git revision synced and the required workloads are ready. Then test the service.

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

Review [failure behavior](/infrastructure/rancher/#availability-and-failure-behavior) before maintenance.

## 5. Maintain and recover

Rancher management state lives in Kubernetes resources and secrets; recovery must account for that state as well as the Helm values. Preserve the platform recovery set and use upstream Rancher backup procedures where configured.

Read the target version’s release notes and record a recovery point before upgrading. See [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/).

## Troubleshooting

When the UI is unavailable, use kubectl directly. Check both Argo Applications, the certificate, and the Rancher pods. Authentication success without cluster access usually points to authorization or agent connectivity rather than ingress.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/rancher/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/rancher/certificate.yaml)

[Official Rancher documentation](https://ranchermanager.docs.rancher.com/).
