---
title: Medusa · Use
description: Backend administration for the Medusa commerce service.
---

<nav class="guide-switcher" aria-label="Medusa guides"><a aria-current="page" href="/user-guide/medusa/">Use</a><a href="/infrastructure/medusa/">Architecture</a><a href="/admin-guide/medusa/">Operate</a></nav>

The backend is configured at [medusa.antblu.net](https://medusa.antblu.net); the Admin dashboard is under [/app](https://medusa.antblu.net/app). Select **Continue with antID** and sign in through Authentik. Access to the Authentik Medusa application is reserved for store administrators. An allowed identity with an Authentik-managed email is provisioned or linked automatically on first login. You can also sign in with an existing Medusa administrator email and password. Use the email address associated with that local account; the Authentik username/password is separate. These are configured behaviors and endpoints, not a statement of current deployment health.

Use Admin to manage commerce data and the API to integrate clients. Customer storefronts are maintained separately. Storefront CORS, public media delivery, payment providers, and outbound notification integrations require their own configuration and verification. Uploaded files use the existing Garage `medusa` bucket; its initial internal URLs require LAN reachability and appropriate read access.

Storefront customers can use email/password or, once the dedicated Google OAuth client and storefront deployment are configured, **Continue with Google** on the integrating storefront's account page. A first Google sign-in provisions a customer account; it does not grant Medusa Admin access.

Once an operator enables the [Odoo catalog integration](/admin-guide/medusa/#odoo-catalog-integration), product names, sale descriptions, SKUs, variants, and catalog prices flow from Odoo daily. Edit those fields in Odoo; Medusa edits are overwritten by the next sync. Imported products start as drafts when Odoo has no website publication field. Manage inventory, images, categories, and storefront setup in Medusa. Orders and customers are not exported to Odoo. This integration requires credential provisioning and deployment before it operates.
