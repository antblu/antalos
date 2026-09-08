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

**Availability classification: Not replicated storage: individual LocalPV volumes cannot survive loss of their owning disk as live copies.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Provisioning | LocalPV Hostpath / node-deployment mode | Creates storage on the selected worker’s local path. |
| Volume placement | WaitForFirstConsumer and node affinity | Claims bind with workload placement; data stays on that node. |
| Replication | Mayastor disabled | Any second data copy comes from PostgreSQL, Redis, Galera, or another application. |
| Retention | Retain storage policy | Avoids automatic cleanup of data; it is not an independent copy. |

### How a failure is handled

OpenEBS does not move a lost node’s existing local data to a healthy node. The application may promote a member on a different LocalPV, or restore a backup into new storage. A provisioner restart can recover volume management while saying nothing about lost payloads.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | Volumes on that worker become inaccessible. Paired databases use surviving members; a singleton or uniquely sharded dataset may wait for the node/disk or require restoration. |
| RTX worker only | Local volumes used by Gitaly and some quorum state on RTX are also affected. A voter’s local state is different from the only usable copy of a user dataset. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

Provisioner/StorageClass changes need to preserve existing volume identity. Scaling a StatefulSet or editing node affinity does not copy files between disks.

### What prevents a stronger HA claim

The storage layer does not provide node-loss HA for a single volume. Capacity and resynchronization traffic on survivors can prevent full redundancy from returning quickly.

### What would improve the availability contract

Choose explicit application-level replication and restore procedures per consumer, or design a separate supported replicated-storage migration. Never describe an unreplicated local PV as HA because the provisioner has multiple pods.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/openebs/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/openebs/app.yaml)
- [`storageclass.yaml`](https://github.com/antblu/antalos/blob/main/apps/openebs/storageclass.yaml)

## Continue

Read the [deployment guide](/admin-guide/openebs/) for dependency order, initial credentials, and integration work. The [official documentation](https://openebs.io/docs/) explains the upstream product; the topology above describes this repository.
