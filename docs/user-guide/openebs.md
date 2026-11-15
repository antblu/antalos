---
title: "OpenEBS · Use"
description: "Request node-local storage and check where Kubernetes places the volume."
---

<nav class="guide-switcher" aria-label="OpenEBS guide sections"><a aria-current="page" href="/user-guide/openebs/">Use</a><a href="/infrastructure/openebs/">Architecture</a><a href="/admin-guide/openebs/">Operate</a></nav>

OpenEBS provisions the node-local persistent volumes used by antalos databases and metrics services. Each volume belongs to one worker. Database replication across separate volumes supplies availability; the local storage layer itself is not configured to replicate data.

## Access

Open [openebs.antblu.net](https://openebs.antblu.net) or use the address your administrator gave you. Ask your administrator for access if you need an account or role.

## Choose a storage class

1. Select `openebs-local` for a workload that understands node-local persistence. Keep requested size in the application’s shared variable.

2. Schedule replicated stateful members on separate nodes so they receive independent volumes and failure domains.

3. Before deleting a claim or replacing a worker, identify the owning database member and its recovery source.

## Get help

Report the affected application and its storage error. Storage provisioning and data recovery are administrator tasks; a new empty volume is not a replacement for missing data.

## During an interruption

If a worker fails, its local volumes stay on that worker. Ask the administrator how the affected application restores access to its data.

See [expected failure behavior and recovery](/infrastructure/openebs/#availability-and-failure-behavior).

## Official documentation

Use the [official OpenEBS documentation](https://openebs.io/docs/) for your installed version. Ask your administrator which optional features are enabled.

See the [architecture](/infrastructure/openebs/) or [deployment guide](/admin-guide/openebs/).
