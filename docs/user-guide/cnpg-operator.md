---
title: "CloudNativePG \u00b7 Overview and User Guide"
description: "What CloudNativePG does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="CloudNativePG guide sections"><a aria-current="page" href="/user-guide/cnpg-operator/">Overview and User Guide</a><a href="/infrastructure/cnpg-operator/">Infrastructure Explanation</a><a href="/admin-guide/cnpg-operator/">Deployment and Admin Guide</a></nav>

CloudNativePG manages PostgreSQL clusters for Antalos applications. Application owners declare database instances, storage, bootstrap credentials, and replication policy; the operator manages PostgreSQL members and stable service endpoints.

## Access and audience

This is a platform service with no standalone user-facing website. Its consumers use Kubernetes resources or internal endpoints.

## Your first workflow

1. Find the application’s Cluster resource in its own service directory. Keep database manifests and credentials with that application.

2. Connect application writers to the operator’s read/write Service rather than a numbered pod.

3. Read primary, ready-instance, and replication state before planning maintenance. A second pod is useful only when it is a healthy replica.

## When you need an administrator

For failed members, inspect Cluster conditions, pod placement, PVC events, and PostgreSQL logs. Do not delete the only surviving volume to clear a Pending condition. Determine the current primary before any recovery operation.

## Availability when using this service

**Not explicitly HA as an operator; it manages replicated database clusters with separate availability contracts.** Database serving depends on whether the lost worker held the primary and/or operator. Correlated loss of a primary and the single operator may extend interruption beyond simple standby promotion.

Read [how redundancy and recovery work](/infrastructure/cnpg-operator/#availability-and-failure-behavior), including upgrade interruptions and external dependencies. These are design expectations, not a live status indicator.

## Official documentation

Use the [official CloudNativePG documentation](https://cloudnative-pg.io/documentation/) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/cnpg-operator/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/cnpg-operator/).
