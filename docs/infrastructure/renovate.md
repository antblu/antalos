---
title: "Renovate · Architecture"
description: "A non-HA scheduled dependency updater with disposable local state and GitHub App authentication."
---

<nav class="guide-switcher" aria-label="Renovate guide sections"><a href="/user-guide/renovate/">Use</a><a aria-current="page" href="/infrastructure/renovate/">Architecture</a><a href="/admin-guide/renovate/">Operate</a></nav>

Renovate is a **non-HA stateless CronJob**, not a continuously running service. Argo CD owns `apps/renovate/` and creates the `renovate` namespace. Each hourly Job runs one pod, processes repositories accessible to the GitHub App installation, and exits. `concurrencyPolicy: Forbid` prevents scheduled runs from overlapping. There is no Deployment, Service, ingress, database, PVC, or PodDisruptionBudget.

## Placement and availability

There is no node selector or affinity. Explicit tolerations permit the cluster's control-plane and `quorum` NoSchedule taints, so all six current nodes are eligible when schedulable and sufficiently resourced. Other taints, resource pressure, or cordons can still prevent scheduling. Each pod requests 100m CPU, 512Mi memory, and 1Gi ephemeral storage; limits are two CPUs, 2Gi memory, and 10Gi ephemeral storage.

A lost node interrupts its current run. Kubernetes retries within the Job's one-retry budget and 50-minute deadline, or work waits for a later hourly Job. In-progress work is not replicated and immediate failover is not guaranteed. GitHub stores durable branches, pull requests, and onboarding state; local clones and cache are rebuilt on each run.

## Authentication and storage

The SealedSecret is scoped to `renovate/renovate-github-app`. Its PEM key is mounted read-only and used by `config.js` to obtain a fresh installation token. The token exists in process memory and expires after an hour. The Job deadline prevents a run from deliberately extending past that lifetime.

The pod runs as UID/GID 12021, has no Kubernetes API token, and drops Linux capabilities. `/tmp` uses an 8Gi `emptyDir`; other container-local files are ephemeral too. No persistent cache or shared filesystem is required. Outbound access to GitHub and dependency registries is required; no inbound endpoint is exposed.

Image tag, schedule, and public App identifiers live in `apps/variables.yaml`. Sealed credentials and all service-specific resources stay in `apps/renovate/`. See the [runbook](/admin-guide/renovate/) for rotation and verification.
