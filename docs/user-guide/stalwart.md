---
title: "Stalwart Mail · Use"
description: "What Stalwart Mail does, how to use it in antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Stalwart Mail guide sections"><a aria-current="page" href="/user-guide/stalwart/">Use</a><a href="/infrastructure/stalwart/">Architecture</a><a href="/admin-guide/stalwart/">Operate</a></nav>

Stalwart is antalos's mail service. It accepts and delivers mail, stores mailbox data, and exposes supported mail and groupware protocols to clients. The HTTPS administration page configures the server; reading mail requires a compatible client or a separately configured webmail application.

## Access and audience

For this installation, use [mail.antblu.net](https://mail.antblu.net). If you use another antalos installation, open the address supplied by its administrator. Ask for the account or role you need before starting.

## Your first workflow

1. Obtain your mailbox address and the server’s supported client settings from the administrator. Add the account to a compatible mail client using TLS.

2. Send a message to an external address, then reply to it. This exercises outbound and inbound delivery, which can fail independently.

3. Use folders, search, and server-supported rules to organize mail. Configure shared or delegated access through the administrator rather than sharing passwords.

4. When reporting delivery problems, include the approximate time, sender, recipient, and any delivery-status message. Do not include mailbox passwords.

## Get help

Report whether sending, receiving, or signing in failed. Include the approximate time, sender, recipient, and any delivery-status message. Never send your mailbox password. The administration website and mail delivery can have different problems.

## During an interruption

Mail clients may reconnect during an interruption. An accepted message may still be waiting for delivery; use the delivery result or recipient confirmation before assuming it arrived.

Administrators can read [the architecture and recovery limits](/infrastructure/stalwart/#availability-and-failure-behavior).

## Official documentation

Use the [official Stalwart Mail documentation](https://stalw.art/docs/) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/stalwart/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/stalwart/).
