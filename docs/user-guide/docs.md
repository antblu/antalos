---
title: "Antalos documentation · Use"
description: "What Antalos documentation does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Antalos documentation guide sections"><a aria-current="page" href="/user-guide/docs/">Use</a><a href="/infrastructure/docs/">Architecture</a><a href="/admin-guide/docs/">Operate</a></nav>

This site is the handbook for using, understanding, and operating Antalos. Each application has three companion guides: a practical user introduction, an explanation of its backend, and an administrator’s deployment runbook. The pages describe repository configuration; live health must be inspected separately.

## Access and audience

For this installation, use [docs.antblu.net](https://docs.antblu.net). If you use another Antalos installation, open the address supplied by its administrator. Ask for the account or role you need before starting.

## Your first workflow

1. Start in Overview and User Guide when you want to use a service. Each page links to the official product manual.

2. Open Infrastructure Explanation to understand request paths, persistent state, placement, and failure limits.

3. Use Deployment and Admin Guide for prerequisites, repository inputs, identity setup, and the work that remains after pods start.

4. Use search for an application or resource name. The On this page menu follows the current article headings, while the three guide links switch perspective without changing application.

## Get help

Include the page address and the heading or link that is unclear. For a factual correction, describe the actual behavior or source file so the administrator can update the handbook.

## During an interruption

The site has more than one serving copy, but shared network dependencies can still make it unreachable. Save essential recovery instructions outside the cluster.

Administrators can read [the architecture and recovery limits](/infrastructure/docs/#availability-and-failure-behavior).

## Official documentation

Use the [official Antalos documentation documentation](https://starlight.astro.build/) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/docs/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/docs/).
