---
title: "Vaultwarden · Use"
description: "What Vaultwarden does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Vaultwarden guide sections"><a aria-current="page" href="/user-guide/vaultwarden/">Use</a><a href="/infrastructure/vaultwarden/">Architecture</a><a href="/admin-guide/vaultwarden/">Operate</a></nav>

Vaultwarden is a self-hosted server compatible with Bitwarden clients. It synchronizes encrypted vault items, attachments, and organization sharing. Your master password protects the vault; access to the server administration page is a different privilege and does not replace a user’s vault credentials.

## Access and audience

For this installation, use [vault.antblu.net](https://vault.antblu.net). If you use another Antalos installation, open the address supplied by its administrator. Ask for the account or role you need before starting.

## Your first workflow

1. Set the custom server URL in your Bitwarden-compatible client before signing in. Use the Antalos vault HTTPS address.

2. Accept the administrator’s invitation and create your account using a strong master password. Record recovery material outside the vault before relying on it.

3. Add a test item and synchronize a second client. Confirm that edits appear on both devices before importing a large collection.

4. Use organizations and collections for intentional sharing. Review access and export/backup options according to your team’s policy.

## Get help

Report whether you cannot sign in, unlock the vault, synchronize, or autofill. These are different tasks. Keep recovery material private and do not delete the local vault data to resolve a connection error.

## During an interruption

The server can be unavailable during maintenance. What remains accessible offline depends on your client and its locally unlocked data; keep your recovery material separately.

Administrators can read [the architecture and recovery limits](/infrastructure/vaultwarden/#availability-and-failure-behavior).

## Official documentation

Use the [official Vaultwarden documentation](https://github.com/dani-garcia/vaultwarden/wiki) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/vaultwarden/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/vaultwarden/).

For everyday vault and client workflows, use the [official Bitwarden help center](https://bitwarden.com/help/), while checking Vaultwarden compatibility for the specific feature.
