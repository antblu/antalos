---
title: "Nextcloud \u00b7 Overview and User Guide"
description: "What Nextcloud does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Nextcloud guide sections"><a aria-current="page" href="/user-guide/nextcloud/">Overview and User Guide</a><a href="/infrastructure/nextcloud/">Infrastructure Explanation</a><a href="/admin-guide/nextcloud/">Deployment and Admin Guide</a></nav>

Nextcloud is the collaboration workspace for files, calendars, contacts, notes, shared boards, and conversations. Antalos adds document editing, Whiteboard, Talk, push notifications, and Context Chat backends. Access to these tools follows your account and sharing permissions; some integrations also need administrator setup.

## Access and audience

The public address is defined by `NEXTCLOUD_HOST` in `apps/variables.yaml`. Use your deployment’s value; Antalos hostnames are examples for a fork.

## Your first workflow

1. Sign in to the Nextcloud web interface, then upload a small file and organize it into a folder. Use the file menu to rename, move, download, or share it.

2. When sharing, choose named recipients or a public link deliberately. Set expiry and password options where offered, then review who can edit or download.

3. Connect the desktop or mobile client using the site URL and browser authorization. For DAV clients that need credentials, use an app password where supported instead of your identity-provider password.

4. Open a document to collaborate through the office integration. Use Talk for conversations and calls, and Whiteboard for shared sketches.

5. Check sync errors and storage notices before deleting local originals. File synchronization also propagates deletions; it is not a substitute for a separate backup.

## When you need an administrator

For a 503 or incomplete rollout, separate database migration, app-code initialization, Redis discovery, and ingress failures. For missing files, verify database and object-store consistency before changing buckets. Read-only configuration requires the controlled maintenance procedure in the upgrade guide.

## Official documentation

Use the [official Nextcloud documentation](https://docs.nextcloud.com/server/latest/user_manual/en/) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/nextcloud/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/nextcloud/).
