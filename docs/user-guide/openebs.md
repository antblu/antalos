---
title: "OpenEBS · Use"
description: "What OpenEBS does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="OpenEBS guide sections"><a aria-current="page" href="/user-guide/openebs/">Use</a><a href="/infrastructure/openebs/">Architecture</a><a href="/admin-guide/openebs/">Operate</a></nav>

OpenEBS provisions the node-local persistent volumes used by Antalos databases and metrics services. Each volume belongs to one worker. Database replication across separate volumes supplies availability; the local storage layer itself is not configured to replicate data.

## Access and audience

This is a platform service with no standalone user-facing website. Its consumers use Kubernetes resources or internal endpoints.

## Your first workflow

1. Select `openebs-local` for a workload that understands node-local persistence. Keep requested size in the application’s shared variable.

2. Schedule replicated stateful members on separate nodes so they receive independent volumes and failure domains.

3. Before deleting a claim or replacing a worker, identify the owning database member and its recovery source.

## Get help

Report the affected application and its storage error. Storage provisioning and data recovery are administrator tasks; a new empty volume is not a replacement for missing data.

## During an interruption

An interruption can affect the applications that depend on this platform service. Ask the administrator to identify the affected service and expected recovery path.

Administrators can read [the architecture and recovery limits](/infrastructure/openebs/#availability-and-failure-behavior).

## Official documentation

Use the [official OpenEBS documentation](https://openebs.io/docs/) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/openebs/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/openebs/).
