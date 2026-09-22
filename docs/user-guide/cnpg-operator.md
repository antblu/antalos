---
title: "CloudNativePG · Use"
description: "What CloudNativePG does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="CloudNativePG guide sections"><a aria-current="page" href="/user-guide/cnpg-operator/">Use</a><a href="/infrastructure/cnpg-operator/">Architecture</a><a href="/admin-guide/cnpg-operator/">Operate</a></nav>

CloudNativePG manages PostgreSQL clusters for Antalos applications. Application owners declare database instances, storage, bootstrap credentials, and replication policy; the operator manages PostgreSQL members and stable service endpoints.

## Access and audience

This is a platform service with no standalone user-facing website. Its consumers use Kubernetes resources or internal endpoints.

## Your first workflow

1. Find the application’s Cluster resource in its own service directory. Keep database manifests and credentials with that application.

2. Connect application writers to the operator’s read/write Service rather than a numbered pod.

3. Read primary, ready-instance, and replication state before planning maintenance. A second pod is useful only when it is a healthy replica.

## Get help

Report the affected application and user-visible database error to its administrator. Application users do not need to operate this database controller directly.

## During an interruption

An interruption can affect the applications that depend on this platform service. Ask the administrator to identify the affected service and expected recovery path.

Administrators can read [the architecture and recovery limits](/infrastructure/cnpg-operator/#availability-and-failure-behavior).

## Official documentation

Use the [official CloudNativePG documentation](https://cloudnative-pg.io/documentation/) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/cnpg-operator/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/cnpg-operator/).
