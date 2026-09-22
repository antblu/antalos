---
title: "Argo CD · Use"
description: "What Argo CD does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Argo CD guide sections"><a aria-current="page" href="/user-guide/argocd/">Use</a><a href="/infrastructure/argocd/">Architecture</a><a href="/admin-guide/argocd/">Operate</a></nav>

Argo CD is the delivery controller for Antalos. It compares the tracked Git revision with Kubernetes and reconciles declared resources. Its interface helps operators distinguish configuration drift from runtime health: Synced means the desired objects match, while Healthy describes resource health.

## Access and audience

For this installation, use [argocd.antblu.net](https://argocd.antblu.net). If you use another Antalos installation, open the address supplied by its administrator. Ask for the account or role you need before starting.

## Your first workflow

1. Open an Application and inspect its source revision, sync status, health, and most recent operation.

2. Use the resource tree to find the specific Deployment, StatefulSet, Job, or certificate blocking progress.

3. Review the diff before a deliberate sync. Automated applications normally reconcile changes after they reach the tracked branch.

4. Make durable fixes in the owning manifest and let reconciliation converge. Keep the runtime condition and last operation result separate in incident notes.

## Get help

Include the Application name, displayed source revision, and operation message. Ask an administrator before using sync, prune, or delete controls when their effect is unclear.

## During an interruption

Application delivery can pause while already running services continue. The application’s own workflow is the clearest evidence of user impact.

Administrators can read [the architecture and recovery limits](/infrastructure/argocd/#availability-and-failure-behavior).

## Official documentation

Use the [official Argo CD documentation](https://argo-cd.readthedocs.io/en/stable/user-guide/) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/argocd/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/argocd/).
