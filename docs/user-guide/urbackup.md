---
title: "UrBackup · Use"
description: "Enroll an UrBackup client, check backup status, and request a restore."
---

<nav class="guide-switcher" aria-label="UrBackup guide sections"><a aria-current="page" href="/user-guide/urbackup/">Use</a><a href="/infrastructure/urbackup/">Architecture</a><a href="/admin-guide/urbackup/">Operate</a></nav>

UrBackup manages file and image backups from supported client devices. Its web interface shows registered clients, backup schedules, completed backups, and restore options. Your device needs a reachable transport and a backup policy before UrBackup can protect its data.

## Access

Open [backup.antblu.net](https://backup.antblu.net) or use the address your administrator gave you. Ask your administrator for access if you need an account or role.

## Enroll a client and check its first backup

1. Ask the administrator to enroll your device and install the matching UrBackup client. Keep the device online during its first full backup.

2. Use the server interface to check the last successful backup and whether the expected files or image volumes were included.

3. For a restore, select the client and backup time carefully, then recover to a separate location first when practical. Confirm the restored files open correctly.

4. Check the latest completed backup and report missed runs or old restore points.

## Get help

Give the device name, backup time, and files or recovery point you need. For a restore request, explain the intended destination so existing files are not accidentally replaced.

## During an interruption

Backup and restore jobs can pause while the server is unavailable. When it returns, check the status of the interrupted job.

See [expected failure behavior and recovery](/infrastructure/urbackup/#availability-and-failure-behavior).

## Official documentation

Use the [official UrBackup documentation](https://www.urbackup.org/administration_manual.html) for your installed version. Ask your administrator which optional features are enabled.

See the [architecture](/infrastructure/urbackup/) or [deployment guide](/admin-guide/urbackup/).
