---
title: "Headscale and Headplane \u00b7 Overview and User Guide"
description: "What Headscale and Headplane does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Headscale and Headplane guide sections"><a aria-current="page" href="/user-guide/headscale/">Overview and User Guide</a><a href="/infrastructure/headscale/">Infrastructure Explanation</a><a href="/admin-guide/headscale/">Deployment and Admin Guide</a></nav>

Headscale coordinates a private network of Tailscale-compatible clients. It distributes identity and network policy; most application traffic travels between clients rather than through the Headscale server. Headplane provides the browser administration interface for machines, users, and network configuration.

## Access and audience

The public address is defined by `HEADSCALE_HOST` in `apps/variables.yaml`. Use your deployment’s value; Antalos hostnames are examples for a fork.

## Your first workflow

1. Install a compatible Tailscale client and set its login server to the Headscale HTTPS endpoint supplied by your administrator. On a new Linux client, use `tailscale up --login-server https://<headscale-host>`.

2. Follow the browser sign-in through Authentik and complete device enrollment. Confirm that the device appears with the intended user and expiry.

3. Use the assigned private address or configured tailnet DNS name to reach permitted services. Enrollment does not override network access rules.

4. Administrators use Headplane under `/admin/` to review devices and access. Remove or expire devices that are retired or lost.

## When you need an administrator

If Headscale will not start, check issuer discovery and NFS restore first. If the VPN works but Headplane fails, check its backend API key and separate database. A policy denying a connection can be correct behavior even when both services are healthy.

## Official documentation

Use the [official Headscale and Headplane documentation](https://headscale.net/stable/) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/headscale/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/headscale/).

The companion [Headplane documentation](https://headplane.net/) explains the browser management interface.
