---
title: "Authentik \u00b7 Overview and User Guide"
description: "What Authentik does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Authentik guide sections"><a aria-current="page" href="/user-guide/authentik/">Overview and User Guide</a><a href="/infrastructure/authentik/">Infrastructure Explanation</a><a href="/admin-guide/authentik/">Deployment and Admin Guide</a></nav>

Authentik is the identity service for Antalos. It signs users in, enforces access policies, and connects applications to a shared account through OpenID Connect, SAML, or a proxy provider. The application portal shows the services your account is allowed to open; a portal tile does not automatically grant a role inside the destination application.

## Access and audience

The public address is defined by `AUTHENTIK_HOST` in `apps/variables.yaml`. Use your deployment’s value; Antalos hostnames are examples for a fork.

## Your first workflow

1. Open the identity portal and sign in with your assigned account. Complete the configured multifactor challenge.

2. Open a permitted application from the portal. If the destination asks for access, request the application role as well as portal membership.

3. Use your account settings to manage supported authentication devices and recovery options. Keep recovery material somewhere you can reach without signing into this cluster.

4. Sign out of sensitive applications explicitly when finishing on a shared device; application sessions and the identity-provider session can have different lifetimes.

## When you need an administrator

If authentication loops, compare the requested callback URI with the provider allowlist, then check the issuer, signing keys, and server clock. If a protected hostname returns an outpost 404, inspect the host-specific outpost route and provider assignment before changing the protected application.

## Availability when using this service

**Partially HA: replicated identity processing and database; external shared media and maintenance limits remain.** One server, one worker, and one database instance can remain. This assumes the healthy members were on different hosts and the surviving worker has enough capacity for the full login/background workload.

Read [how redundancy and recovery work](/infrastructure/authentik/#availability-and-failure-behavior), including upgrade interruptions and external dependencies. These are design expectations, not a live status indicator.

## Official documentation

Use the [official Authentik documentation](https://docs.goauthentik.io/) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/authentik/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/authentik/).
