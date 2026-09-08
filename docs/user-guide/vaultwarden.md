---
title: "Vaultwarden \u00b7 Overview and User Guide"
description: "What Vaultwarden does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Vaultwarden guide sections"><a aria-current="page" href="/user-guide/vaultwarden/">Overview and User Guide</a><a href="/infrastructure/vaultwarden/">Infrastructure Explanation</a><a href="/admin-guide/vaultwarden/">Deployment and Admin Guide</a></nav>

Vaultwarden is a self-hosted server compatible with Bitwarden clients. It synchronizes encrypted vault items, attachments, and organization sharing. Your master password protects the vault; access to the server administration page is a different privilege and does not replace a user’s vault credentials.

## Access and audience

The public address is defined by `VAULTWARDEN_HOST` in `apps/variables.yaml`. Use your deployment’s value; Antalos hostnames are examples for a fork.

## Your first workflow

1. Set the custom server URL in your Bitwarden-compatible client before signing in. Use the Antalos vault HTTPS address.

2. Accept the administrator’s invitation and create your account using a strong master password. Record recovery material outside the vault before relying on it.

3. Add a test item and synchronize a second client. Confirm that edits appear on both devices before importing a large collection.

4. Use organizations and collections for intentional sharing. Review access and export/backup options according to your team’s policy.

## When you need an administrator

If a native client cannot log in, confirm its custom server URL and TLS trust. Missing invitations may be expected while SMTP is absent. For failed attachment operations, inspect the NFS mount separately from PostgreSQL readiness.

## Availability when using this service

**Not HA at the application layer: one vault server; PostgreSQL alone is replicated.** Server access stops if the single application pod was there. When only the standby database member is lost, the server may continue with reduced database redundancy; loss of the primary adds promotion/reconnection time.

Read [how redundancy and recovery work](/infrastructure/vaultwarden/#availability-and-failure-behavior), including upgrade interruptions and external dependencies. These are design expectations, not a live status indicator.

## Official documentation

Use the [official Vaultwarden documentation](https://github.com/dani-garcia/vaultwarden/wiki) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/vaultwarden/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/vaultwarden/).

For everyday vault and client workflows, use the [official Bitwarden help center](https://bitwarden.com/help/), while checking Vaultwarden compatibility for the specific feature.
