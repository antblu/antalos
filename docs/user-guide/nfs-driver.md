---
title: "NFS CSI driver · Use"
description: "What NFS CSI driver does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="NFS CSI driver guide sections"><a aria-current="page" href="/user-guide/nfs-driver/">Use</a><a href="/infrastructure/nfs-driver/">Architecture</a><a href="/admin-guide/nfs-driver/">Operate</a></nav>

The NFS CSI driver lets Kubernetes pods mount an existing NFS server. Antalos uses it for shared application files and Litestream backups. The driver connects storage to pods; it does not create or replicate the external NFS server.

## Access and audience

This is a platform service with no standalone user-facing website. Its consumers use Kubernetes resources or internal endpoints.

## Your first workflow

1. Keep each service’s PersistentVolume and PersistentVolumeClaim in its application directory. Match its export, access mode, mount options, and runtime user.

2. Use the service’s documented mount path and avoid treating its requested capacity as an export quota.

3. When access fails, identify the pod UID/GID and the failing operation before changing server-side ownership.

## Get help

Report the application, file operation, time, and error. Avoid deleting files or remounting storage to solve an unexplained application issue.

## During an interruption

An interruption can affect the applications that depend on this platform service. Ask the administrator to identify the affected service and expected recovery path.

Administrators can read [the architecture and recovery limits](/infrastructure/nfs-driver/#availability-and-failure-behavior).

## Official documentation

Use the [official NFS CSI driver documentation](https://github.com/kubernetes-csi/csi-driver-nfs) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/nfs-driver/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/nfs-driver/).
