---
title: "MetalLB \u00b7 Deployment and Admin Guide"
description: "Deploy MetalLB with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="MetalLB guide sections"><a href="/user-guide/metallb/">Overview and User Guide</a><a href="/infrastructure/metallb/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/metallb/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/metallb/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Set `METALLB_CHART_VERSION` and `METALLB_ADDRESS_POOL`; reserve the range on the actual network.

2. Deploy the chart before pool CRDs are applied. Ensure speaker traffic and L2 adjacency meet the upstream network requirements.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application metallb

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n metallb-system get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

No OIDC or user login is involved. Kubernetes RBAC governs address pools and Services. Router/DNS administration is a separate responsibility.

## 4. Connect and operate the service

1. Assign the ingress address, then test access from a client on the intended network.

2. For public services, configure public DNS and NAT/firewall rules for every published port. Preserve intentional shared-IP rules for mail and mixed TCP/UDP listeners.

## Availability before maintenance

**Partially HA: distributed address advertisement; controller allocation and the physical network remain separate.**

Existing allocations and advertisement have a different dependency path from assigning new IPs. A controller restart should not be described as proof that all existing traffic stops or all new allocations continue.

Document the external network failure domains, make control-component redundancy explicit if required, and measure reachability from actual LAN/WAN clients after advertiser loss.

Use the [component-by-component failure contract](/infrastructure/metallb/#availability-and-failure-behavior) before a node drain, database promotion, or upgrade. Restoring a healthy replica count must include data resynchronization and restored voting capacity, not just Running pods.

## 5. Maintain and recover

Address pools and Service declarations live in Git. Reserve the same range outside DHCP and other infrastructure allocation systems. Network configuration outside Kubernetes must be retained separately.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

An unassigned address points to pool/allocation problems. An assigned but unreachable address points to advertisement, traffic policy, endpoint health, or network routing. Start with Service events and speaker logs.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/metallb/app.yaml)

[Official MetalLB documentation](https://metallb.io/usage/).
