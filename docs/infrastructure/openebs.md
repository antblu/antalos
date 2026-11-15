---
title: "OpenEBS · Architecture"
description: "Node-local volumes, provisioner behavior, and application replication."
---

<nav class="guide-switcher" aria-label="OpenEBS guide sections"><a href="/user-guide/openebs/">Use</a><a aria-current="page" href="/infrastructure/openebs/">Architecture</a><a href="/admin-guide/openebs/">Operate</a></nav>

The OpenEBS chart enables LocalPV Hostpath and node-deployment mode with base path `/var/mnt/openebs-local`. LVM, ZFS, rawfile, and replicated Mayastor engines are disabled. The namespace permits the host access required by provisioning helpers; ordinary application namespaces do not need that exception.

## Components

<figure class="architecture-diagram" aria-label="OpenEBS · component flow">
<div class="diagram-heading">OpenEBS · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Request</span><ul><li>PVC → openebs-local</li><li>WaitForFirstConsumer placement</li></ul></li><li class="diagram-stage"><span class="diagram-label">Provision</span><ul><li>LocalPV Hostpath</li><li>Worker /var/mnt/openebs-local</li></ul></li><li class="diagram-stage"><span class="diagram-label">Persist locally</span><ul><li>One volume on one worker</li><li>Database owns replication / backups</li></ul></li></ol>
</figure>

## Data and recovery

Volume data resides on the worker’s local disk. Losing that disk loses its local copy. Preserve application-level replication and off-node backups; Git can recreate a claim but cannot recover its previous contents.

## Availability and failure behavior

**Not replicated storage: individual LocalPV volumes cannot survive loss of their owning disk as live copies.**

The expected behavior assumes healthy replicas with the intended placement and reachable dependencies. Verify it in a failure drill on your deployment.

### Component redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Provisioning | LocalPV Hostpath / node-deployment mode | Creates storage on the selected worker’s local path. |
| Volume placement | WaitForFirstConsumer and node affinity | Claims bind with workload placement; data stays on that node. |
| Replication | Mayastor disabled | Any second data copy comes from PostgreSQL, Redis, Galera, or another application. |
| Retention | Retain storage policy | Avoids automatic cleanup of data; it is not an independent copy. |

### Failover and recovery

OpenEBS does not move a lost node’s existing local data to a healthy node. The application may promote a member on a different LocalPV, or restore a backup into new storage. A provisioner restart can recover volume management while saying nothing about lost payloads.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | Volumes on that worker become inaccessible. Paired databases use surviving members; a singleton or uniquely sharded dataset may wait for the node/disk or require restoration. |
| RTX worker only | Local volumes used by Gitaly and some quorum state on RTX are also affected. A voter’s local state is different from the only usable copy of a user dataset. |
| A second failure before recovery | Check surviving endpoints and capacity before further maintenance. For replicated data or voting groups, check the remaining copies and quorum. |

Losing the RTX Proxmox host takes down both its worker and control-plane VMs, including the default external API endpoint. Factor that dependency into [whole-host failure testing](/infrastructure/availability/#physical-hosts-and-the-api-endpoint).

### Upgrades and voluntary maintenance

Provisioner/StorageClass changes need to preserve existing volume identity. Scaling a StatefulSet or editing node affinity does not copy files between disks.

### Availability limits

The storage layer does not provide node-loss HA for a single volume. Capacity and resynchronization traffic on survivors can prevent full redundancy from returning quickly.

### Improving availability

Choose explicit application-level replication and restore procedures per consumer, or design a separate supported replicated-storage migration. Never describe an unreplicated local PV as HA because the provisioner has multiple pods.

See [platform availability](/infrastructure/availability/) for shared dependencies and failure-test criteria.

## Configuration ownership

Keep Kubernetes resources in `apps/openebs/` and environment-specific inputs in `apps/variables.yaml`. Use the application’s backup procedure for any settings it stores in its database.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/openebs/app.yaml)
- [`storageclass.yaml`](https://github.com/antblu/antalos/blob/main/apps/openebs/storageclass.yaml)

## Related guides

- [deployment guide](/admin-guide/openebs/) for setup and recovery
- [official documentation](https://openebs.io/docs/) for product configuration
