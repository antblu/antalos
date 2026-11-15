---
title: "Authentik · Use"
description: "Sign in to Authentik, open an application, and manage recovery options."
---

<nav class="guide-switcher" aria-label="Authentik guide sections"><a aria-current="page" href="/user-guide/authentik/">Use</a><a href="/infrastructure/authentik/">Architecture</a><a href="/admin-guide/authentik/">Operate</a></nav>

Authentik is the identity service for antalos. It signs users in, enforces access policies, and connects applications to a shared account through OpenID Connect, SAML, or a proxy provider. The application portal shows the services your account is allowed to open; a portal tile does not automatically grant a role inside the destination application.

## Access

Open [auth.antblu.net](https://auth.antblu.net) or use the address your administrator gave you. Ask your administrator for access if you need an account or role.

## Sign in and open an application

1. Open the identity portal and sign in with your assigned account. Complete the configured multifactor challenge.

2. Open a permitted application from the portal. If the destination asks for access, request the application role as well as portal membership.

3. Use your account settings to manage supported authentication devices and recovery options. Keep recovery material somewhere you can reach without signing into this cluster.

4. Sign out of sensitive applications before leaving a shared device. Application sessions and the Authentik session can expire at different times.

## Get help

Report where sign-in stopped and whether the problem affects one application or every application. Do not send passwords, recovery codes, or the full address of a login callback.

## During an interruption

An identity outage can prevent new sign-ins across several services. Existing application sessions may behave differently depending on the service.

See [expected failure behavior and recovery](/infrastructure/authentik/#availability-and-failure-behavior).

## Official documentation

Use the [official Authentik documentation](https://docs.goauthentik.io/) for your installed version. Ask your administrator which optional features are enabled.

See the [architecture](/infrastructure/authentik/) or [deployment guide](/admin-guide/authentik/).
