---
title: "BentoPDF · Use"
description: "What BentoPDF does, how to use it in antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="BentoPDF guide sections"><a aria-current="page" href="/user-guide/bentopdf/">Use</a><a href="/infrastructure/bentopdf/">Architecture</a><a href="/admin-guide/bentopdf/">Operate</a></nav>

BentoPDF provides browser-based PDF tools for merging, splitting, rotating, compressing, and converting documents. antalos serves the simple edition behind Authentik. Ordinary PDF processing happens in the browser, so performance and available memory depend on the device opening the tool.

## Access and audience

For this installation, use [pdf.antblu.net](https://pdf.antblu.net). If you use another antalos installation, open the address supplied by its administrator. Ask for the account or role you need before starting.

## Your first workflow

1. Open the PDF site and complete the Authentik sign-in if prompted.

2. Choose a tool before selecting files. For a merge, add the PDFs and arrange them in the intended order; for a split, choose the required pages.

3. Run the operation and download the output. Open the result and confirm page order, readability, and any form fields before replacing the original.

4. Keep the original file until the result is accepted. Large jobs may require a desktop browser with more available memory.

## Get help

Include the tool you used, the error, and a non-sensitive description of the file type and size. Keep the original file and do not send private documents unless your administrator requests an appropriate support copy.

## During an interruption

A service or sign-in interruption can prevent opening the tool. Keep the original and download the completed result before closing your working session.

Administrators can read [the architecture and recovery limits](/infrastructure/bentopdf/#availability-and-failure-behavior).

## Official documentation

Use the [official BentoPDF documentation](https://www.bentopdf.com/docs/) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/bentopdf/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/bentopdf/).
