---
title: "Open WebUI · Use"
description: "Sign in to Open WebUI and start a chat with an available model."
---

<nav class="guide-switcher" aria-label="Open WebUI guide sections"><a aria-current="page" href="/user-guide/open-webui/">Use</a><a href="/infrastructure/open-webui/">Architecture</a><a href="/admin-guide/open-webui/">Operate</a></nav>

Open WebUI is the browser interface for chatting with configured AI models and working with uploaded knowledge. It can connect to compatible model services such as LiteLLM. The web interface does not host a model by itself, and the models available to a user depend on administrator connections and permissions.

## Access

Open [ai.antblu.net](https://ai.antblu.net) or use the address your administrator gave you. Ask your administrator for access if you need an account or role.

## Start a chat

1. Open the AI site and sign in with the configured Authentik provider. A newly provisioned account may need administrator approval or a role assignment.

2. Choose an available model and start a short conversation. Model names represent administrator-configured endpoints and may have different capabilities.

3. Attach a document only when the selected model and workspace allow it. Read the configured provider’s data-handling terms before sending sensitive material.

4. Use separate conversations or workspaces for different projects. Review generated answers against original documents and external evidence.

## Get help

Include the model name, approximate time, and error. Say whether ordinary chat works while document upload or search fails. Avoid submitting sensitive prompts or documents as part of a support report.

## During an interruption

If a chat or model stream stops, check whether the selected model and any document service still respond.

See [expected failure behavior and recovery](/infrastructure/open-webui/#availability-and-failure-behavior).

## Official documentation

Use the [official Open WebUI documentation](https://docs.openwebui.com/) for your installed version. Ask your administrator which optional features are enabled.

See the [architecture](/infrastructure/open-webui/) or [deployment guide](/admin-guide/open-webui/).
