---
title: "OpenEBS \u00b7 Overview and User Guide"
description: "What OpenEBS does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="OpenEBS guide sections"><a aria-current="page" href="/user-guide/openebs/">Overview and User Guide</a><a href="/infrastructure/openebs/">Infrastructure Explanation</a><a href="/admin-guide/openebs/">Deployment and Admin Guide</a></nav>

OpenEBS provisions the node-local persistent volumes used by Antalos databases and metrics services. Each volume belongs to one worker. Database replication across separate volumes supplies availability; the local storage layer itself is not configured to replicate data.

## Access and audience

This is a platform service with no standalone user-facing website. Its consumers use Kubernetes resources or internal endpoints.

## Your first workflow

1. Select `openebs-local` for a workload that understands node-local persistence. Keep requested size in the application’s shared variable.

2. Schedule replicated stateful members on separate nodes so they receive independent volumes and failure domains.

3. Before deleting a claim or replacing a worker, identify the owning database member and its recovery source.

## When you need an administrator

Pending claims can be caused by scheduling, node affinity, or missing host capacity. Determine whether the consumer must schedule before binding. Do not move a local PV’s node affinity to imply that its data exists on another node.

## Availability when using this service

**Not replicated storage: individual LocalPV volumes cannot survive loss of their owning disk as live copies.** Volumes on that worker become inaccessible. Paired databases use surviving members; a singleton or uniquely sharded dataset may wait for the node/disk or require restoration.

Read [how redundancy and recovery work](/infrastructure/openebs/#availability-and-failure-behavior), including upgrade interruptions and external dependencies. These are design expectations, not a live status indicator.

## Official documentation

Use the [official OpenEBS documentation](https://openebs.io/docs/) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/openebs/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/openebs/).
