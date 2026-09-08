---
title: "Stalwart Mail \u00b7 Overview and User Guide"
description: "What Stalwart Mail does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Stalwart Mail guide sections"><a aria-current="page" href="/user-guide/stalwart/">Overview and User Guide</a><a href="/infrastructure/stalwart/">Infrastructure Explanation</a><a href="/admin-guide/stalwart/">Deployment and Admin Guide</a></nav>

Stalwart is Antalos’s mail service. It accepts and delivers mail, stores mailbox data, and exposes supported mail and groupware protocols to clients. The HTTPS administration page configures the server; reading mail requires a compatible client or a separately configured webmail application.

## Access and audience

The public address is defined by `MAIL_HOST` in `apps/variables.yaml`. Use your deployment’s value; Antalos hostnames are examples for a fork.

## Your first workflow

1. Obtain your mailbox address and the server’s supported client settings from the administrator. Add the account to a compatible mail client using TLS.

2. Send a message to an external address, then reply to it. This exercises outbound and inbound delivery, which can fail independently.

3. Use folders, search, and server-supported rules to organize mail. Configure shared or delegated access through the administrator rather than sharing passwords.

4. When reporting delivery problems, include the approximate time, sender, recipient, and any delivery-status message. Do not include mailbox passwords.

## When you need an administrator

For bootstrap 401 responses, verify the administrator Secret format and the active recovery-auth configuration without printing the credential. For mail delays, inspect queue and delivery errors, DNS, and upstream reachability. A healthy HTTPS page does not prove SMTP delivery.

## Official documentation

Use the [official Stalwart Mail documentation](https://stalw.art/docs/) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/stalwart/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/stalwart/).
