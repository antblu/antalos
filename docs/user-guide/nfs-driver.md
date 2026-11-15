---
title: "NFS CSI driver · Use"
description: "Declare a volume and check that an application can mount its NFS export."
---

<nav class="guide-switcher" aria-label="NFS CSI driver guide sections"><a aria-current="page" href="/user-guide/nfs-driver/">Use</a><a href="/infrastructure/nfs-driver/">Architecture</a><a href="/admin-guide/nfs-driver/">Operate</a></nav>

The NFS CSI driver lets Kubernetes pods mount an existing NFS server. antalos uses it for shared application files and Litestream backups. The driver connects storage to pods; it does not create or replicate the external NFS server.

## Access

Open [nfs.antblu.net](https://nfs.antblu.net) or use the address your administrator gave you. Ask your administrator for access if you need an account or role.

## Mount an NFS export

1. Keep each service’s PersistentVolume and PersistentVolumeClaim in its application directory. Match its export, access mode, mount options, and runtime user.

2. Use the service’s documented mount path and avoid treating its requested capacity as an export quota.

3. When access fails, identify the pod UID/GID and the failing operation before changing server-side ownership.

## Get help

Report the application, file operation, time, and error. Avoid deleting files or remounting storage to solve an unexplained application issue.

## During an interruption

If pods cannot mount their volumes, ask the administrator to check the mount events and the NFS export.

See [expected failure behavior and recovery](/infrastructure/nfs-driver/#availability-and-failure-behavior).

## Official documentation

Use the [official NFS CSI driver documentation](https://github.com/kubernetes-csi/csi-driver-nfs) for your installed version. Ask your administrator which optional features are enabled.

See the [architecture](/infrastructure/nfs-driver/) or [deployment guide](/admin-guide/nfs-driver/).
