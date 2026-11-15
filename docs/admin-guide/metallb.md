---
title: "MetalLB · Operate"
description: "Configure MetalLB address pools and verify LoadBalancer reachability."
---

<nav class="guide-switcher" aria-label="MetalLB guide sections"><a href="/user-guide/metallb/">Use</a><a href="/infrastructure/metallb/">Architecture</a><a aria-current="page" href="/admin-guide/metallb/">Operate</a></nav>

Use `apps/metallb/` with the [shared deployment workflow](/admin-guide/deploy-an-application/) to render manifests, prepare credentials, and reconcile the Application.

## 1. Prepare dependencies and inputs

1. Set `METALLB_CHART_VERSION` and `METALLB_ADDRESS_POOL`; reserve the range on the actual network.

2. Deploy the chart before pool CRDs are applied. Ensure speaker traffic and L2 adjacency meet the upstream network requirements.

## 2. Reconcile the application

Push the reviewed manifests and variables to the branch Argo CD tracks. Let the root app-of-apps discover the Application and run its hooks in order. Keep unresolved templates out of direct Kubernetes applies.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application metallb

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n metallb-system get pods,svc,pvc
```

Confirm the expected Git revision synced and the required workloads are ready. Then test the service.

## 3. Complete identity and first access

No OIDC or user login is involved. Kubernetes RBAC governs address pools and Services. Router/DNS administration is a separate responsibility.

## 4. Connect and operate the service

1. Assign the ingress address, then test access from a client on the intended network.

2. For public services, configure public DNS and NAT/firewall rules for every published port. Preserve intentional shared-IP rules for mail and mixed TCP/UDP listeners.

## Availability before maintenance

**Partially HA: distributed address advertisement; controller allocation and the physical network remain separate.**

Existing allocations and advertisement have a different dependency path from assigning new IPs. A controller restart should not be described as proof that all existing traffic stops or all new allocations continue.

Document the external network failure domains, make control-component redundancy explicit if required, and measure reachability from actual LAN/WAN clients after advertiser loss.

Review [failure behavior](/infrastructure/metallb/#availability-and-failure-behavior) before maintenance.

## 5. Maintain and recover

Address pools and Service declarations live in Git. Reserve the same range outside DHCP and other infrastructure allocation systems. Network configuration outside Kubernetes must be retained separately.

Read the target version’s release notes and record a recovery point before upgrading. See [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/).

## Troubleshooting

An unassigned address points to pool/allocation problems. An assigned but unreachable address points to advertisement, traffic policy, endpoint health, or network routing. Start with Service events and speaker logs.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/metallb/app.yaml)

[Official MetalLB documentation](https://metallb.io/usage/).
