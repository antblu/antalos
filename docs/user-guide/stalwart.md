---
title: "Stalwart Mail · Use"
description: "Configure a mail client and check message submission and delivery."
---

<nav class="guide-switcher" aria-label="Stalwart Mail guide sections"><a aria-current="page" href="/user-guide/stalwart/">Use</a><a href="/infrastructure/stalwart/">Architecture</a><a href="/admin-guide/stalwart/">Operate</a></nav>

Stalwart is antalos's mail service. It accepts and delivers mail, stores mailbox data, and exposes supported mail and groupware protocols to clients. The HTTPS administration page configures the server; reading mail requires a compatible client or a separately configured webmail application.

## Access

Open [mail.antblu.net](https://mail.antblu.net) or use the address your administrator gave you. Ask your administrator for access if you need an account or role.

## Set up a mail client

1. Obtain your mailbox address and the server’s supported client settings from the administrator. Add the account to a compatible mail client using TLS.

2. Send a message to an external address, then reply to it. This exercises outbound and inbound delivery, which can fail independently.

3. Use folders, search, and server-supported rules to organize mail. Ask the administrator to set up shared or delegated access. Keep your password private.

4. When reporting delivery problems, include the approximate time, sender, recipient, and any delivery-status message. Do not include mailbox passwords.

## Get help

Report whether sending, receiving, or signing in failed. Include the approximate time, sender, recipient, and any delivery-status message. Never send your mailbox password. The administration website and mail delivery can have different problems.

## During an interruption

Mail clients may reconnect during an interruption. An accepted message may still be waiting for delivery; use the delivery result or recipient confirmation before assuming it arrived.

See [expected failure behavior and recovery](/infrastructure/stalwart/#availability-and-failure-behavior).

## Official documentation

Use the [official Stalwart Mail documentation](https://stalw.art/docs/) for your installed version. Ask your administrator which optional features are enabled.

See the [architecture](/infrastructure/stalwart/) or [deployment guide](/admin-guide/stalwart/).
