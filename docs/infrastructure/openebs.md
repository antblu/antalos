---
title: "OpenEBS \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for OpenEBS in Antalos."
---

<nav class="guide-switcher" aria-label="OpenEBS guide sections"><a href="/user-guide/openebs/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/openebs/">Infrastructure Explanation</a><a href="/admin-guide/openebs/">Deployment and Admin Guide</a></nav>

The OpenEBS chart enables LocalPV Hostpath and node-deployment mode with base path `/var/mnt/openebs-local`. LVM, ZFS, rawfile, and replicated Mayastor engines are disabled. The namespace permits the host access required by provisioning helpers; ordinary application namespaces do not need that exception.

## Component boundaries

<figure class="architecture-diagram" aria-label="OpenEBS · component flow">
<div class="diagram-heading">OpenEBS · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Request</span><ul><li>PVC → openebs-local</li><li>WaitForFirstConsumer placement</li></ul></li><li class="diagram-stage"><span class="diagram-label">Provision</span><ul><li>LocalPV Hostpath</li><li>Worker /var/mnt/openebs-local</li></ul></li><li class="diagram-stage"><span class="diagram-label">Persist locally</span><ul><li>One volume on one worker</li><li>Database owns replication / backups</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Volume data resides on the worker’s local disk. Losing that disk loses its local copy. Preserve application-level replication and off-node backups; Git can recreate a claim but cannot recover its previous contents.

## Availability and failure behavior

LocalPV is a persistence primitive, not a replicated storage system. Database failover depends on another healthy member with its own volume. Two members on the same physical failure domain do not provide host-loss protection.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/openebs/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/openebs/app.yaml)
- [`storageclass.yaml`](https://github.com/antblu/antalos/blob/main/apps/openebs/storageclass.yaml)

## Continue

Read the [deployment guide](/admin-guide/openebs/) for dependency order, initial credentials, and integration work. The [official documentation](https://openebs.io/docs/) explains the upstream product; the topology above describes this repository.
