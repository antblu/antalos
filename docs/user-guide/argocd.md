---
title: "Argo CD \u00b7 Overview and User Guide"
description: "What Argo CD does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Argo CD guide sections"><a aria-current="page" href="/user-guide/argocd/">Overview and User Guide</a><a href="/infrastructure/argocd/">Infrastructure Explanation</a><a href="/admin-guide/argocd/">Deployment and Admin Guide</a></nav>

Argo CD is the delivery controller for Antalos. It compares the tracked Git revision with Kubernetes and reconciles declared resources. Its interface helps operators distinguish configuration drift from runtime health: Synced means the desired objects match, while Healthy describes resource health.

## Access and audience

The public address is defined by `ARGOCD_HOST` in `apps/variables.yaml`. Use your deployment’s value; Antalos hostnames are examples for a fork.

## Your first workflow

1. Open an Application and inspect its source revision, sync status, health, and most recent operation.

2. Use the resource tree to find the specific Deployment, StatefulSet, Job, or certificate blocking progress.

3. Review the diff before a deliberate sync. Automated applications normally reconcile changes after they reach the tracked branch.

4. Make durable fixes in the owning manifest and let reconciliation converge. Keep the runtime condition and last operation result separate in incident notes.

## When you need an administrator

For apparent stale health, inspect `argocd.argoproj.io/skip-reconcile`, operation state, and hook conditions. Remove a reconciliation pause only after understanding why it was set. A failed historical pod should not outweigh healthy current replicas in the incident conclusion.

## Official documentation

Use the [official Argo CD documentation](https://argo-cd.readthedocs.io/en/stable/user-guide/) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/argocd/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/argocd/).
