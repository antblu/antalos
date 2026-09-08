---
title: "Antalos documentation \u00b7 Overview and User Guide"
description: "What Antalos documentation does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Antalos documentation guide sections"><a aria-current="page" href="/user-guide/docs/">Overview and User Guide</a><a href="/infrastructure/docs/">Infrastructure Explanation</a><a href="/admin-guide/docs/">Deployment and Admin Guide</a></nav>

This site is the handbook for using, understanding, and operating Antalos. Each application has three companion guides: a practical user introduction, an explanation of its backend, and an administrator’s deployment runbook. The pages describe repository configuration; live health must be inspected separately.

## Access and audience

The public address is defined by `DOCS_HOST` in `apps/variables.yaml`. Use your deployment’s value; Antalos hostnames are examples for a fork.

## Your first workflow

1. Start in Overview and User Guide when you want to use a service. Each page links to the official product manual.

2. Open Infrastructure Explanation to understand request paths, persistent state, placement, and failure limits.

3. Use Deployment and Admin Guide for prerequisites, repository inputs, identity setup, and the work that remains after pods start.

4. Use search for an application or resource name. The On this page menu follows the current article headings, while the three guide links switch perspective without changing application.

## When you need an administrator

If content is old, compare the published image and `DOCS_IMAGE_TAG` with the running revision. If one URL fails, inspect the static route and redirect configuration. `/healthz` checks NGINX liveness, not the correctness of every guide.

## Availability when using this service

**HA static serving tier for node loss; current zero-unavailable rollout can be blocked by placement.** One pod can continue serving. However, hard anti-affinity prevents the lost replica from simply joining the survivor on the same node; availability returns to full redundancy only when another eligible placement is available.

Read [how redundancy and recovery work](/infrastructure/docs/#availability-and-failure-behavior), including upgrade interruptions and external dependencies. These are design expectations, not a live status indicator.

## Official documentation

Use the [official Antalos documentation documentation](https://starlight.astro.build/) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/docs/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/docs/).
