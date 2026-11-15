---
title: "Rancher · Use"
description: "Select a cluster and inspect Kubernetes workloads in Rancher."
---

<nav class="guide-switcher" aria-label="Rancher guide sections"><a aria-current="page" href="/user-guide/rancher/">Use</a><a href="/infrastructure/rancher/">Architecture</a><a href="/admin-guide/rancher/">Operate</a></nav>

Rancher provides a browser workspace for inspecting Kubernetes clusters, workloads, namespaces, and access. In antalos it runs inside the cluster it manages. Use it to understand current state and investigate workloads, while keeping long-lived desired configuration in the GitOps repository.

## Access

Open [rancher.antblu.net](https://rancher.antblu.net) or use the address your administrator gave you. Ask your administrator for access if you need an account or role.

## Inspect a workload

1. Open Rancher, sign in, and select the intended cluster and project before viewing workloads.

2. Choose the namespace and inspect the workload’s pods, events, logs, and resource usage. Identify whether the issue is scheduling, startup, readiness, or application behavior.

3. Use the resource view to understand the Kubernetes objects involved. Record the namespace and object name when escalating an issue.

4. Make persistent changes in the owning antalos manifest. Argo CD may reconcile a one-off UI change back to the repository value.

## Get help

Report the cluster, namespace, and action you could not complete. Do not alter unrelated workloads to work around an access error. Rancher access and the application you are inspecting can fail separately.

## During an interruption

The management interface can be unavailable while applications keep running. Ask the administrator to distinguish a Rancher access issue from a workload outage.

See [expected failure behavior and recovery](/infrastructure/rancher/#availability-and-failure-behavior).

## Official documentation

Use the [official Rancher documentation](https://ranchermanager.docs.rancher.com/) for your installed version. Ask your administrator which optional features are enabled.

See the [architecture](/infrastructure/rancher/) or [deployment guide](/admin-guide/rancher/).
