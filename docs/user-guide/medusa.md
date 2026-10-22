---
title: Medusa · Use
description: Backend administration for the Medusa commerce service.
---

<nav class="guide-switcher" aria-label="Medusa guides"><a aria-current="page" href="/user-guide/medusa/">Use</a><a href="/infrastructure/medusa/">Architecture</a><a href="/admin-guide/medusa/">Operate</a></nav>

The backend is configured at [medusa.antblu.net](https://medusa.antblu.net); the Admin dashboard is under [/app](https://medusa.antblu.net/app). Select **Continue with antID** and sign in through Authentik. Access to the Authentik Medusa application is reserved for store administrators. An allowed identity with an Authentik-managed email is provisioned or linked automatically on first login. Local email/password login is disabled for Admin. These are configured behaviors and endpoints, not a statement of current deployment health.

Use Admin to manage commerce data and the API to integrate future clients. The Next.js storefront, storefront CORS origin, public media delivery, payment providers, and outbound notification integrations are separate follow-up work. Uploaded files use the existing Garage `medusa` bucket; its initial internal URLs require LAN reachability and appropriate read access.
