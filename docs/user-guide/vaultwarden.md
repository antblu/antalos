---
title: "Vaultwarden · Use"
description: "Connect a Bitwarden-compatible client to Vaultwarden and sync a test item."
---

<nav class="guide-switcher" aria-label="Vaultwarden guide sections"><a aria-current="page" href="/user-guide/vaultwarden/">Use</a><a href="/infrastructure/vaultwarden/">Architecture</a><a href="/admin-guide/vaultwarden/">Operate</a></nav>

Vaultwarden is a self-hosted server compatible with Bitwarden clients. It synchronizes encrypted vault items, attachments, and organization sharing. Your master password protects the vault; access to the server administration page is a different privilege and does not replace a user’s vault credentials.

## Access

Open [vault.antblu.net](https://vault.antblu.net) or use the address your administrator gave you. Ask your administrator for access if you need an account or role.

## Set up a vault client

1. Set the custom server URL in your Bitwarden-compatible client before signing in. Use the antalos vault HTTPS address.

2. Accept the administrator’s invitation and create your account using a strong master password. Record recovery material outside the vault before relying on it.

3. Add a test item and synchronize a second client. Confirm that edits appear on both devices before importing a large collection.

4. Use organizations and collections for intentional sharing. Review access and export/backup options according to your team’s policy.

## Get help

Report whether you cannot sign in, unlock the vault, synchronize, or autofill. These are different tasks. Keep recovery material private and do not delete the local vault data to resolve a connection error.

## During an interruption

The server can be unavailable during maintenance. What remains accessible offline depends on your client and its locally unlocked data; keep your recovery material separately.

See [expected failure behavior and recovery](/infrastructure/vaultwarden/#availability-and-failure-behavior).

## Official documentation

Use the [official Vaultwarden documentation](https://github.com/dani-garcia/vaultwarden/wiki) for your installed version. Ask your administrator which optional features are enabled.

See the [architecture](/infrastructure/vaultwarden/) or [deployment guide](/admin-guide/vaultwarden/).

For everyday vault and client workflows, use the [official Bitwarden help center](https://bitwarden.com/help/), while checking Vaultwarden compatibility for the specific feature.
