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

Partial availability: node plugins can mount from multiple workers, but the declared NFS server is one external endpoint. Shared access is not storage-server HA.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/nfs-driver/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/nfs-driver/app.yaml)

## Continue

Read the [deployment guide](/admin-guide/nfs-driver/) for dependency order, initial credentials, and integration work. The [official documentation](https://github.com/kubernetes-csi/csi-driver-nfs) explains the upstream product; the topology above describes this repository.
