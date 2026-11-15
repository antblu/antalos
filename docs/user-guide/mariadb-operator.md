---
title: "MariaDB operator · Use"
description: "Find MariaDB database, user, and grant declarations and check Galera health."
---

<nav class="guide-switcher" aria-label="MariaDB operator guide sections"><a aria-current="page" href="/user-guide/mariadb-operator/">Use</a><a href="/infrastructure/mariadb-operator/">Architecture</a><a href="/admin-guide/mariadb-operator/">Operate</a></nav>

The MariaDB operator turns database declarations into managed MariaDB servers, users, grants, and backups. In antalos it supports SuiteCRM's Galera database. Database ownership stays with the service directory, making credentials and storage easier to recover together.

## Access

Use Kubernetes resources or internal endpoints to work with this service.

## Work with a MariaDB declaration

1. Read SuiteCRM’s MariaDB, Database, User, and Grant resources together to understand the application’s database contract.

2. Use the stable database service in application configuration. Inspect Galera state before maintenance.

3. Read PhysicalBackup status to confirm database backup jobs complete; then verify recovery through a separate restore drill.

## Get help

Report the affected application and failed action. Database administration belongs to the service operator; do not change database membership to resolve a user-interface error.

## During an interruption

If an application loses database access, ask its administrator to check its Galera cluster and writer endpoint.

See [expected failure behavior and recovery](/infrastructure/mariadb-operator/#availability-and-failure-behavior).

## Official documentation

Use the [official MariaDB operator documentation](https://github.com/mariadb-operator/mariadb-operator) for your installed version. Ask your administrator which optional features are enabled.

See the [architecture](/infrastructure/mariadb-operator/) or [deployment guide](/admin-guide/mariadb-operator/).
