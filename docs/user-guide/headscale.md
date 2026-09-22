---
title: "Headscale and Headplane · Use"
description: "What Headscale and Headplane does, how to use it in antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Headscale and Headplane guide sections"><a aria-current="page" href="/user-guide/headscale/">Use</a><a href="/infrastructure/headscale/">Architecture</a><a href="/admin-guide/headscale/">Operate</a></nav>

Headscale coordinates a private network of Tailscale-compatible clients. It distributes identity and network policy; most application traffic travels between clients rather than through the Headscale server. Headplane provides the browser administration interface for machines, users, and network configuration.

## Access and audience

For this installation, use [vpn.antblu.net](https://vpn.antblu.net). If you use another antalos installation, open the address supplied by its administrator. Ask for the account or role you need before starting.

## Your first workflow

1. Install a compatible Tailscale client and set its login server to the Headscale HTTPS endpoint supplied by your administrator. On a new Linux client, use `tailscale up --login-server https://<headscale-host>`.

2. Follow the browser sign-in through Authentik and complete device enrollment. Confirm that the device appears with the intended user and expiry.

3. Use the assigned private address or configured tailnet DNS name to reach permitted services. Enrollment does not override network access rules.

4. Administrators use Headplane under `/admin/` to review devices and access. Remove or expire devices that are retired or lost.

## Get help

Report the affected device, whether it can reach the internet, and which private service is unreachable. Avoid deleting its enrollment to solve an unexplained connection problem; ask the administrator first.

## During an interruption

An outage can prevent device enrollment or coordination updates. Report whether an existing private connection still works; do not assume every connection fails in the same way.

Administrators can read [the architecture and recovery limits](/infrastructure/headscale/#availability-and-failure-behavior).

## Official documentation

Use the [official Headscale and Headplane documentation](https://headscale.net/stable/) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/headscale/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/headscale/).

The companion [Headplane documentation](https://headplane.net/) explains the browser management interface.
