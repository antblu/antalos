---
title: "UrBackup · Use"
description: "What UrBackup does, how to use it in antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="UrBackup guide sections"><a aria-current="page" href="/user-guide/urbackup/">Use</a><a href="/infrastructure/urbackup/">Architecture</a><a href="/admin-guide/urbackup/">Operate</a></nav>

UrBackup manages file and image backups from supported client devices. Its web interface shows registered clients, backup schedules, completed backups, and restore options. A running server is only the first step: clients need a reachable transport and a backup policy before any protected data exists.

## Access and audience

For this installation, use [backup.antblu.net](https://backup.antblu.net). If you use another antalos installation, open the address supplied by its administrator. Ask for the account or role you need before starting.

## Your first workflow

1. Ask the administrator to enroll your device and install the matching UrBackup client. Keep the device online during its first full backup.

2. Use the server interface to check the last successful backup and whether the expected files or image volumes were included.

3. For a restore, select the client and backup time carefully, then recover to a separate location first when practical. Confirm the restored files open correctly.

4. Report repeated missed backups or unexpectedly old restore points. A client being online does not mean its latest backup completed successfully.

## Get help

Give the device name, backup time, and files or recovery point you need. For a restore request, explain the intended destination so existing files are not accidentally replaced.

## During an interruption

Backup and restore work can pause while the server is unavailable. An old successful backup does not establish the status of the current run.

Administrators can read [the architecture and recovery limits](/infrastructure/urbackup/#availability-and-failure-behavior).

## Official documentation

Use the [official UrBackup documentation](https://www.urbackup.org/administration_manual.html) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/urbackup/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/urbackup/).
