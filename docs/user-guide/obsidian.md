---
title: Obsidian LiveSync · Use
description: Sync a local Obsidian vault through antalos and find the official Obsidian and LiveSync instructions.
---

<nav class="guide-switcher" aria-label="Obsidian LiveSync guides"><a aria-current="page" href="/user-guide/obsidian/">Use</a><a href="/infrastructure/obsidian/">Architecture</a><a href="/admin-guide/obsidian/">Operate</a></nav>

Obsidian is the notes application on your device. antalos provides a CouchDB backend for the community **Self-hosted LiveSync** plugin to synchronize your vault. The server address is not a browser editor for your notes.

## Before connecting a vault

Ask your administrator for the remote address, database name, supported authentication method, and any setup or encryption material. The configured antalos address is [obsidian.antblu.net](https://obsidian.antblu.net). Opening it in a browser may show sign-in or database administration, rather than your notes.

The endpoint uses Authentik authorization. A successful browser sign-in does not by itself prove that your device's sync client can authenticate; have the administrator confirm the native-client access path before migrating a vault.

## Set up synchronization

1. Back up the local vault and choose one device for the initial setup.
2. Install Self-hosted LiveSync in that vault and follow the maintainer's [quick setup guide](https://github.com/vrtmrz/obsidian-livesync/blob/main/docs/quick_setup.md).
3. Use the administrator-provided connection settings. Keep setup credentials and encryption passphrases private.
4. Create a small test note and confirm it reaches a second device before relying on synchronization for normal work.
5. Follow the existing-vault/additional-device instructions for later devices; do not initialize or overwrite the remote database again.

The plugin's setup guide recommends avoiding another synchronization service writing to the same vault. Follow its conflict and encryption guidance for your installed plugin version.

## When synchronization stops

Your local notes and remote synchronization are separate. Keep a local copy, record the plugin error and affected device, and contact the administrator. Avoid database resets or choosing an overwrite option to resolve an unexplained connection error.

Changes and deletions can synchronize between devices. Retain separate backups and review conflicts rather than assuming that the most recently displayed copy is the one to keep.

## Official documentation

Use [Obsidian Help](https://help.obsidian.md/) for notes and vaults. Use the [Self-hosted LiveSync project documentation](https://github.com/vrtmrz/obsidian-livesync) for the community plugin; it is separate from Obsidian's own Sync service. Administrators can continue to the [antalos backend guide](/admin-guide/obsidian/).
