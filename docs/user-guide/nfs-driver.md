---
title: "NFS CSI driver \u00b7 Overview and User Guide"
description: "What NFS CSI driver does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="NFS CSI driver guide sections"><a aria-current="page" href="/user-guide/nfs-driver/">Overview and User Guide</a><a href="/infrastructure/nfs-driver/">Infrastructure Explanation</a><a href="/admin-guide/nfs-driver/">Deployment and Admin Guide</a></nav>

The NFS CSI driver lets Kubernetes pods mount an existing NFS server. Antalos uses it for shared application files and Litestream backups. The driver connects storage to pods; it does not create or replicate the external NFS server.

## Access and audience

This is a platform service with no standalone user-facing website. Its consumers use Kubernetes resources or internal endpoints.

## Your first workflow

1. Keep each service’s PersistentVolume and PersistentVolumeClaim in its application directory. Match its export, access mode, mount options, and runtime user.

2. Use the service’s documented mount path and avoid treating its requested capacity as an export quota.

3. When access fails, identify the pod UID/GID and the failing operation before changing server-side ownership.

## When you need an administrator

For mount failures, inspect PVC binding, node-plugin events, protocol support, and network reachability. For permission errors, inspect numeric ownership and export mappings. Avoid applying recursive fsGroup changes to populated shared data as a generic fix.

## Official documentation

Use the [official NFS CSI driver documentation](https://github.com/kubernetes-csi/csi-driver-nfs) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/nfs-driver/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/nfs-driver/).
