---
title: "NFS CSI driver \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for NFS CSI driver in Antalos."
---

<nav class="guide-switcher" aria-label="NFS CSI driver guide sections"><a href="/user-guide/nfs-driver/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/nfs-driver/">Infrastructure Explanation</a><a href="/admin-guide/nfs-driver/">Deployment and Admin Guide</a></nav>

The official CSI chart provides control components and node plugins in `kube-system`. Static application volumes reference exports on the configured NFS endpoint. RWX mounts let different workers access the same files, but application locking and concurrent-write rules still apply.

## Component boundaries

<figure class="architecture-diagram" aria-label="NFS CSI driver · component flow">
<div class="diagram-heading">NFS CSI driver · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Request</span><ul><li>Application PV / PVC</li><li>Export and mount options</li></ul></li><li class="diagram-stage"><span class="diagram-label">Mount</span><ul><li>CSI controller / node plugin</li><li>Pod runtime UID / GID</li></ul></li><li class="diagram-stage"><span class="diagram-label">External storage</span><ul><li>NFS server / export permissions</li><li>Shared files / separate backup policy</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

The external export contains the data. PV/PVC objects only describe access to it. Preserve export contents, server permissions, mount protocol requirements, and backup history outside the cluster.

## Availability and failure behavior

**Availability classification: Not HA storage: the CSI path has node coverage, but all declared exports depend on one external endpoint.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| CSI node plugins | Node-level mounts | Another worker can mount a reachable export. |
| CSI control components | Chart-managed | Provisioning and new mounts have their own management dependencies. |
| NFS data service | One declared server endpoint | No replicated NFS servers, failover address, or export fencing is declared by Antalos. |

### How a failure is handled

After a consumer node fails, a replacement pod can mount the same export if the API, CSI path, network, server, permissions, and file locks are available. That supports relocation. If the NFS server fails, moving the consumer to another worker does not recover its data path.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | Other consumers can continue using a healthy export; single-instance applications still incur restart time. Persistent handles/locks and application recovery rules determine whether a replacement can safely start. |
| RTX worker only | No NFS-specific voter. Shared infrastructure/control-plane effects still apply to new scheduling and mounts. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

Updating CSI components is different from stopping the external server. Existing mounted I/O may continue during some controller outages, while new provisioning/mount work pauses.

### What prevents a stronger HA claim

ReadWriteMany describes mount access, not redundant server copies or concurrent-writer safety. Backups and Retain policies do not provide a second live NFS service.

### What would improve the availability contract

Document or implement external NFS failover with correct locking/fencing, protect exports, and test both already-mounted I/O and a new pod mount during server/control-component failure.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/nfs-driver/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/nfs-driver/app.yaml)

## Continue

Read the [deployment guide](/admin-guide/nfs-driver/) for dependency order, initial credentials, and integration work. The [official documentation](https://github.com/kubernetes-csi/csi-driver-nfs) explains the upstream product; the topology above describes this repository.
