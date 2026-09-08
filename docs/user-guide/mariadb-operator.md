---
title: "MariaDB operator \u00b7 Overview and User Guide"
description: "What MariaDB operator does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="MariaDB operator guide sections"><a aria-current="page" href="/user-guide/mariadb-operator/">Overview and User Guide</a><a href="/infrastructure/mariadb-operator/">Infrastructure Explanation</a><a href="/admin-guide/mariadb-operator/">Deployment and Admin Guide</a></nav>

The MariaDB operator turns database declarations into managed MariaDB servers, users, grants, and backups. In Antalos it supports SuiteCRM’s Galera database. Database ownership stays with the service directory, making credentials and storage easier to recover together.

## Access and audience

This is a platform service with no standalone user-facing website. Its consumers use Kubernetes resources or internal endpoints.

## Your first workflow

1. Read SuiteCRM’s MariaDB, Database, User, and Grant resources together to understand the application’s database contract.

2. Use the stable database service in application configuration. Inspect Galera state before maintenance.

3. Read PhysicalBackup status to confirm database backup jobs complete; then verify recovery through a separate restore drill.

## When you need an administrator

Webhook errors can block new resources even when SQL remains available. For Galera failures, distinguish operator reconciliation from quorum, state transfer, image compatibility, and volume ownership problems.

## Availability when using this service

**HA management design: replicated operator and webhook; database HA still belongs to each managed MariaDB.** One controller and webhook can remain. If the same worker held a Galera data node, the database separately needs its surviving data member and arbitrator to retain membership.

Read [how redundancy and recovery work](/infrastructure/mariadb-operator/#availability-and-failure-behavior), including upgrade interruptions and external dependencies. These are design expectations, not a live status indicator.

## Official documentation

Use the [official MariaDB operator documentation](https://github.com/mariadb-operator/mariadb-operator) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/mariadb-operator/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/mariadb-operator/).
