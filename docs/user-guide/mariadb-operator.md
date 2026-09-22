---
title: "MariaDB operator · Use"
description: "What MariaDB operator does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="MariaDB operator guide sections"><a aria-current="page" href="/user-guide/mariadb-operator/">Use</a><a href="/infrastructure/mariadb-operator/">Architecture</a><a href="/admin-guide/mariadb-operator/">Operate</a></nav>

The MariaDB operator turns database declarations into managed MariaDB servers, users, grants, and backups. In Antalos it supports SuiteCRM’s Galera database. Database ownership stays with the service directory, making credentials and storage easier to recover together.

## Access and audience

This is a platform service with no standalone user-facing website. Its consumers use Kubernetes resources or internal endpoints.

## Your first workflow

1. Read SuiteCRM’s MariaDB, Database, User, and Grant resources together to understand the application’s database contract.

2. Use the stable database service in application configuration. Inspect Galera state before maintenance.

3. Read PhysicalBackup status to confirm database backup jobs complete; then verify recovery through a separate restore drill.

## Get help

Report the affected application and failed action. Database administration belongs to the service operator; do not change database membership to resolve a user-interface error.

## During an interruption

An interruption can affect the applications that depend on this platform service. Ask the administrator to identify the affected service and expected recovery path.

Administrators can read [the architecture and recovery limits](/infrastructure/mariadb-operator/#availability-and-failure-behavior).

## Official documentation

Use the [official MariaDB operator documentation](https://github.com/mariadb-operator/mariadb-operator) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/mariadb-operator/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/mariadb-operator/).
