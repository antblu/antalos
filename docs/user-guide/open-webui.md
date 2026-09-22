---
title: "Open WebUI · Use"
description: "What Open WebUI does, how to use it in antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Open WebUI guide sections"><a aria-current="page" href="/user-guide/open-webui/">Use</a><a href="/infrastructure/open-webui/">Architecture</a><a href="/admin-guide/open-webui/">Operate</a></nav>

Open WebUI is the browser interface for chatting with configured AI models and working with uploaded knowledge. It can connect to compatible model services such as LiteLLM. The web interface does not host a model by itself, and the models available to a user depend on administrator connections and permissions.

## Access and audience

For this installation, use [ai.antblu.net](https://ai.antblu.net). If you use another antalos installation, open the address supplied by its administrator. Ask for the account or role you need before starting.

## Your first workflow

1. Open the AI site and sign in with the configured Authentik provider. A newly provisioned account may need administrator approval or a role assignment.

2. Choose an available model and start a short conversation. Model names represent administrator-configured endpoints and may have different capabilities.

3. Attach a document only when the selected model and workspace allow it. Read the configured provider’s data-handling terms before sending sensitive material.

4. Use separate conversations or workspaces for different projects. Review generated answers against original documents and external evidence.

## Get help

Include the model name, approximate time, and error. Say whether ordinary chat works while document upload or search fails. Avoid submitting sensitive prompts or documents as part of a support report.

## During an interruption

A chat or model stream can stop during an outage. A reachable chat page does not guarantee that the selected model or document service is available.

Administrators can read [the architecture and recovery limits](/infrastructure/open-webui/#availability-and-failure-behavior).

## Official documentation

Use the [official Open WebUI documentation](https://docs.openwebui.com/) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/open-webui/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/open-webui/).
