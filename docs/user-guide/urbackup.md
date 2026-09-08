---
title: "UrBackup \u00b7 Overview and User Guide"
description: "What UrBackup does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="UrBackup guide sections"><a aria-current="page" href="/user-guide/urbackup/">Overview and User Guide</a><a href="/infrastructure/urbackup/">Infrastructure Explanation</a><a href="/admin-guide/urbackup/">Deployment and Admin Guide</a></nav>

UrBackup manages file and image backups from supported client devices. Its web interface shows registered clients, backup schedules, completed backups, and restore options. A running server is only the first step: clients need a reachable transport and a backup policy before any protected data exists.

## Access and audience

The public address is defined by `URBACKUP_HOST` in `apps/variables.yaml`. Use your deployment’s value; Antalos hostnames are examples for a fork.

## Your first workflow

1. Ask the administrator to enroll your device and install the matching UrBackup client. Keep the device online during its first full backup.

2. Use the server interface to check the last successful backup and whether the expected files or image volumes were included.

3. For a restore, select the client and backup time carefully, then recover to a separate location first when practical. Confirm the restored files open correctly.

4. Report repeated missed backups or unexpectedly old restore points. A client being online does not mean its latest backup completed successfully.

## When you need an administrator

For startup permission errors, inspect which of the two mounts fails and the configured UID/GID. For invisible clients, inspect transport and discovery reachability rather than the HTTPS certificate. For an outpost 404, repair the Authentik callback route/provider mapping.

## Availability when using this service

**Not HA: one backup server, restored with two external NFS exports.** If it hosts UrBackup, the UI and backup processing stop until the replacement starts and can access both exports. Neither readiness probes nor anti-affinity create a second replica.

Read [how redundancy and recovery work](/infrastructure/urbackup/#availability-and-failure-behavior), including upgrade interruptions and external dependencies. These are design expectations, not a live status indicator.

## Official documentation

Use the [official UrBackup documentation](https://www.urbackup.org/administration_manual.html) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/urbackup/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/urbackup/).
