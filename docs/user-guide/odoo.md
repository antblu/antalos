---
title: Odoo · Use
description: Sign in to Odoo Community and start configuring business applications.
---

<nav class="guide-switcher" aria-label="Odoo guides"><a aria-current="page" href="/user-guide/odoo/">Use</a><a href="/infrastructure/odoo/">Architecture</a><a href="/admin-guide/odoo/">Operate</a></nav>

Open [Odoo](https://odoo.antblu.net) and use the Authentik sign-in option, or sign in with an existing local Odoo account. Authentik access requires membership in **Odoo Users**. An eligible first Authentik login provisions an internal Odoo account with the configured JIT template access; Odoo administrators manage its permissions afterward. An administrator can create users and install the required Community applications from Apps. Enterprise-only features require their own subscription and deployment.

The initial administrator login is `admin`; its generated password is available through the [administrator runbook](/admin-guide/odoo/#initial-administrator-access). After initial setup, use named accounts and configure company details, locale, and outgoing email in Settings.

Two application replicas share PostgreSQL sessions and S3 attachments. Daily backups run online. Database promotion can briefly interrupt requests; retry after recovery. The initial HA migration requires signing in again. Report login problems or missing attachments to the administrator; do not create a replacement database.
