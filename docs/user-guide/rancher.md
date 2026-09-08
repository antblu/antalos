---
title: "Rancher \u00b7 Overview and User Guide"
description: "What Rancher does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Rancher guide sections"><a aria-current="page" href="/user-guide/rancher/">Overview and User Guide</a><a href="/infrastructure/rancher/">Infrastructure Explanation</a><a href="/admin-guide/rancher/">Deployment and Admin Guide</a></nav>

Rancher provides a browser workspace for inspecting Kubernetes clusters, workloads, namespaces, and access. In Antalos it runs inside the cluster it manages. Use it to understand current state and investigate workloads, while keeping long-lived desired configuration in the GitOps repository.

## Access and audience

The public address is defined by `RANCHER_HOST` in `apps/variables.yaml`. Use your deployment’s value; Antalos hostnames are examples for a fork.

## Your first workflow

1. Open Rancher, sign in, and select the intended cluster and project before viewing workloads.

2. Choose the namespace and inspect the workload’s pods, events, logs, and resource usage. Identify whether the issue is scheduling, startup, readiness, or application behavior.

3. Use the resource view to understand the Kubernetes objects involved. Record the namespace and object name when escalating an issue.

4. Make persistent changes in the owning Antalos manifest. Argo CD may reconcile a one-off UI change back to the repository value.

## When you need an administrator

When the UI is unavailable, use kubectl directly. Check both Argo Applications, the certificate, and the Rancher pods. Authentication success without cluster access usually points to authorization or agent connectivity rather than ingress.

## Availability when using this service

**HA management web tier; it is not an independent control plane for recovering this cluster.** A surviving server can remain accessible, assuming ingress and the API work. No second copy of a Rancher pod is a substitute for the etcd data and credentials underneath its resources.

Read [how redundancy and recovery work](/infrastructure/rancher/#availability-and-failure-behavior), including upgrade interruptions and external dependencies. These are design expectations, not a live status indicator.

## Official documentation

Use the [official Rancher documentation](https://ranchermanager.docs.rancher.com/) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/rancher/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/rancher/).
