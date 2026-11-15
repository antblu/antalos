---
title: "NFS CSI driver · Architecture"
description: "CSI mount handling and the external NFS dependency."
---

<nav class="guide-switcher" aria-label="NFS CSI driver guide sections"><a href="/user-guide/nfs-driver/">Use</a><a aria-current="page" href="/infrastructure/nfs-driver/">Architecture</a><a href="/admin-guide/nfs-driver/">Operate</a></nav>

The official CSI chart provides control components and node plugins in `kube-system`. Static application volumes reference exports on the configured NFS endpoint. RWX mounts let different workers access the same files, but application locking and concurrent-write rules still apply.

## Components

<figure class="architecture-diagram" aria-label="NFS CSI driver · component flow">
<div class="diagram-heading">NFS CSI driver · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Request</span><ul><li>Application PV / PVC</li><li>Export and mount options</li></ul></li><li class="diagram-stage"><span class="diagram-label">Mount</span><ul><li>CSI controller / node plugin</li><li>Pod runtime UID / GID</li></ul></li><li class="diagram-stage"><span class="diagram-label">External storage</span><ul><li>NFS server / export permissions</li><li>Shared files / separate backup policy</li></ul></li></ol>
</figure>

## Data and recovery

The external export contains the data. PV/PVC objects only describe access to it. Preserve export contents, server permissions, mount protocol requirements, and backup history outside the cluster.

## Availability and failure behavior

**Not HA storage: the CSI path has node coverage, but all declared exports depend on one external endpoint.**

The expected behavior assumes healthy replicas with the intended placement and reachable dependencies. Verify it in a failure drill on your deployment.

### Component redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| CSI node plugins | Node-level mounts | Another worker can mount a reachable export. |
| CSI control components | Chart-managed | Provisioning and new mounts have their own management dependencies. |
| NFS data service | One declared server endpoint | No replicated NFS servers, failover address, or export fencing is declared by antalos. |

### Failover and recovery

After a consumer node fails, a replacement pod can mount the same export if the API, CSI path, network, server, permissions, and file locks are available. That supports relocation. If the NFS server fails, moving the consumer to another worker does not recover its data path.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | Other consumers can continue using a healthy export; single-instance applications still incur restart time. Persistent handles/locks and application recovery rules determine whether a replacement can safely start. |
| RTX worker only | No NFS-specific voter. Shared infrastructure/control-plane effects still apply to new scheduling and mounts. |
| A second failure before recovery | Check surviving endpoints and capacity before further maintenance. For replicated data or voting groups, check the remaining copies and quorum. |

Losing the RTX Proxmox host takes down both its worker and control-plane VMs, including the default external API endpoint. Factor that dependency into [whole-host failure testing](/infrastructure/availability/#physical-hosts-and-the-api-endpoint).

### Upgrades and voluntary maintenance

Updating CSI components is different from stopping the external server. Existing mounted I/O may continue during some controller outages, while new provisioning/mount work pauses.

### Availability limits

ReadWriteMany describes mount access, not redundant server copies or concurrent-writer safety. Backups and Retain policies do not provide a second live NFS service.

### Improving availability

Document or implement external NFS failover with correct locking/fencing, protect exports, and test both already-mounted I/O and a new pod mount during server/control-component failure.

See [platform availability](/infrastructure/availability/) for shared dependencies and failure-test criteria.

## Configuration ownership

Keep Kubernetes resources in `apps/nfs-driver/` and environment-specific inputs in `apps/variables.yaml`. Use the application’s backup procedure for any settings it stores in its database.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/nfs-driver/app.yaml)

## Related guides

- [deployment guide](/admin-guide/nfs-driver/) for setup and recovery
- [official documentation](https://github.com/kubernetes-csi/csi-driver-nfs) for product configuration
