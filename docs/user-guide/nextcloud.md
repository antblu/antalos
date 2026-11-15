---
title: "Nextcloud · Use"
description: "Share and sync files, edit documents, and use Talk in Nextcloud."
---

<nav class="guide-switcher" aria-label="Nextcloud guide sections"><a aria-current="page" href="/user-guide/nextcloud/">Use</a><a href="/infrastructure/nextcloud/">Architecture</a><a href="/admin-guide/nextcloud/">Operate</a></nav>

Nextcloud is the collaboration workspace for files, calendars, tasks, contacts, notes, shared boards, and conversations. Use Tasks to keep to-do lists and calendar-linked tasks in sync across your Nextcloud clients. antalos adds document editing, Whiteboard, Talk, push notifications, and Context Chat backends. Access to these tools follows your account and sharing permissions; some integrations also need administrator setup.

## Access

Open [nextcloud.antblu.net](https://nextcloud.antblu.net) or use the address your administrator gave you. Ask your administrator for access if you need an account or role.

## Upload, share, and sync a file

1. Sign in to the Nextcloud web interface, then upload a small file and organize it into a folder. Use the file menu to rename, move, download, or share it.

2. Choose who can open the file by sharing with named recipients or creating a public link. Set expiry and password options where offered, then review who can edit or download.

3. Connect the desktop or mobile client using the site URL and browser authorization. For DAV clients that need credentials, use an app password where supported instead of your identity-provider password.

4. Open a document to collaborate through the office integration. Use Talk for conversations and calls, and Whiteboard for shared sketches.

5. Check sync errors and storage notices before deleting local originals. Keep a separate backup because Nextcloud sync propagates deletions.

## Get help

Report the feature that failed: file sync, sharing, document editing, a call, or an AI request. Include the time and client error. Keep a local copy of unsynced work and avoid repeatedly uploading or deleting the same file.

## During an interruption

An interruption can affect file access, calls, or individual integrations differently. Keep unsynced work and follow the client’s retry guidance. You may need to reopen the call or document after reconnecting.

See [expected failure behavior and recovery](/infrastructure/nextcloud/#availability-and-failure-behavior).

## Official documentation

Use the [official Nextcloud documentation](https://docs.nextcloud.com/server/latest/user_manual/en/) for your installed version. Ask your administrator which optional features are enabled.

See the [architecture](/infrastructure/nextcloud/) or [deployment guide](/admin-guide/nextcloud/).
