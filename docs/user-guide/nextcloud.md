---
title: "Nextcloud · Use"
description: "What Nextcloud does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Nextcloud guide sections"><a aria-current="page" href="/user-guide/nextcloud/">Use</a><a href="/infrastructure/nextcloud/">Architecture</a><a href="/admin-guide/nextcloud/">Operate</a></nav>

Nextcloud is the collaboration workspace for files, calendars, contacts, notes, shared boards, and conversations. Antalos adds document editing, Whiteboard, Talk, push notifications, and Context Chat backends. Access to these tools follows your account and sharing permissions; some integrations also need administrator setup.

## Access and audience

For this installation, use [nextcloud.antblu.net](https://nextcloud.antblu.net). If you use another Antalos installation, open the address supplied by its administrator. Ask for the account or role you need before starting.

## Your first workflow

1. Sign in to the Nextcloud web interface, then upload a small file and organize it into a folder. Use the file menu to rename, move, download, or share it.

2. When sharing, choose named recipients or a public link deliberately. Set expiry and password options where offered, then review who can edit or download.

3. Connect the desktop or mobile client using the site URL and browser authorization. For DAV clients that need credentials, use an app password where supported instead of your identity-provider password.

4. Open a document to collaborate through the office integration. Use Talk for conversations and calls, and Whiteboard for shared sketches.

5. Check sync errors and storage notices before deleting local originals. File synchronization also propagates deletions; it is not a substitute for a separate backup.

## Get help

Report the feature that failed: file sync, sharing, document editing, a call, or an AI request. Include the time and client error. Keep a local copy of unsynced work and avoid repeatedly uploading or deleting the same file.

## During an interruption

An interruption can affect file access, calls, or individual integrations differently. Keep unsynced work and follow the client’s retry guidance. A reconnected call or editing session may need to be reopened.

Administrators can read [the architecture and recovery limits](/infrastructure/nextcloud/#availability-and-failure-behavior).

## Official documentation

Use the [official Nextcloud documentation](https://docs.nextcloud.com/server/latest/user_manual/en/) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/nextcloud/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/nextcloud/).
