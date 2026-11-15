---
title: "CloudNativePG · Use"
description: "Find an application's PostgreSQL Cluster and use its read/write Service."
---

<nav class="guide-switcher" aria-label="CloudNativePG guide sections"><a aria-current="page" href="/user-guide/cnpg-operator/">Use</a><a href="/infrastructure/cnpg-operator/">Architecture</a><a href="/admin-guide/cnpg-operator/">Operate</a></nav>

CloudNativePG manages PostgreSQL clusters for antalos applications. Application owners declare database instances, storage, bootstrap credentials, and replication policy; the operator manages PostgreSQL members and stable service endpoints.

## Access

Use Kubernetes resources or internal endpoints to work with this service.

## Connect to a PostgreSQL cluster

1. Find the application’s Cluster resource in its own service directory. Keep database manifests and credentials with that application.

2. Connect application writers to the operator’s read/write Service so they can reach the current primary.

3. Read primary, ready-instance, and replication state before planning maintenance. A second pod is useful only when it is a healthy replica.

## Get help

Report the affected application and user-visible database error to its administrator. Application users do not need to operate this database controller directly.

## During an interruption

If an application reports a database error during an outage, ask its administrator to check the database primary and read/write Service.

See [expected failure behavior and recovery](/infrastructure/cnpg-operator/#availability-and-failure-behavior).

## Official documentation

Use the [official CloudNativePG documentation](https://cloudnative-pg.io/documentation/) for your installed version. Ask your administrator which optional features are enabled.

See the [architecture](/infrastructure/cnpg-operator/) or [deployment guide](/admin-guide/cnpg-operator/).
