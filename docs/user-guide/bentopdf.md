---
title: "BentoPDF \u00b7 Overview and User Guide"
description: "What BentoPDF does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="BentoPDF guide sections"><a aria-current="page" href="/user-guide/bentopdf/">Overview and User Guide</a><a href="/infrastructure/bentopdf/">Infrastructure Explanation</a><a href="/admin-guide/bentopdf/">Deployment and Admin Guide</a></nav>

BentoPDF provides browser-based PDF tools for merging, splitting, rotating, compressing, and converting documents. Antalos serves the simple edition behind Authentik. Ordinary PDF processing happens in the browser, so performance and available memory depend on the device opening the tool.

## Access and audience

The public address is defined by `BENTOPDF_HOST` in `apps/variables.yaml`. Use your deployment’s value; Antalos hostnames are examples for a fork.

## Your first workflow

1. Open the PDF site and complete the Authentik sign-in if prompted.

2. Choose a tool before selecting files. For a merge, add the PDFs and arrange them in the intended order; for a split, choose the required pages.

3. Run the operation and download the output. Open the result and confirm page order, readability, and any form fields before replacing the original.

4. Keep the original file until the result is accepted. Large jobs may require a desktop browser with more available memory.

## When you need an administrator

If the page works but a tool fails, inspect browser errors for blocked worker resources, cross-origin isolation, or memory exhaustion. If the page never opens, resolve forward-auth and callback routing before troubleshooting PDF processing.

## Availability when using this service

**HA static serving tier; access depends on the shared identity and ingress services.** The other serving replica can handle new requests. There is no persistent application volume attached to the lost node that must move before the static site returns.

Read [how redundancy and recovery work](/infrastructure/bentopdf/#availability-and-failure-behavior), including upgrade interruptions and external dependencies. These are design expectations, not a live status indicator.

## Official documentation

Use the [official BentoPDF documentation](https://www.bentopdf.com/docs/) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/bentopdf/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/bentopdf/).
