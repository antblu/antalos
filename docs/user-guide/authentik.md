---
title: "Authentik · Use"
description: "What Authentik does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Authentik guide sections"><a aria-current="page" href="/user-guide/authentik/">Use</a><a href="/infrastructure/authentik/">Architecture</a><a href="/admin-guide/authentik/">Operate</a></nav>

Authentik is the identity service for Antalos. It signs users in, enforces access policies, and connects applications to a shared account through OpenID Connect, SAML, or a proxy provider. The application portal shows the services your account is allowed to open; a portal tile does not automatically grant a role inside the destination application.

## Access and audience

For this installation, use [auth.antblu.net](https://auth.antblu.net). If you use another Antalos installation, open the address supplied by its administrator. Ask for the account or role you need before starting.

## Your first workflow

1. Open the identity portal and sign in with your assigned account. Complete the configured multifactor challenge.

2. Open a permitted application from the portal. If the destination asks for access, request the application role as well as portal membership.

3. Use your account settings to manage supported authentication devices and recovery options. Keep recovery material somewhere you can reach without signing into this cluster.

4. Sign out of sensitive applications explicitly when finishing on a shared device; application sessions and the identity-provider session can have different lifetimes.

## Get help

Report where sign-in stopped and whether the problem affects one application or every application. Do not send passwords, recovery codes, or the full address of a login callback.

## During an interruption

An identity outage can prevent new sign-ins across several services. Existing application sessions may behave differently depending on the service.

Administrators can read [the architecture and recovery limits](/infrastructure/authentik/#availability-and-failure-behavior).

## Official documentation

Use the [official Authentik documentation](https://docs.goauthentik.io/) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/authentik/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/authentik/).
