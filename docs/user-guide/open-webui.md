---
title: "Open WebUI \u00b7 Overview and User Guide"
description: "What Open WebUI does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Open WebUI guide sections"><a aria-current="page" href="/user-guide/open-webui/">Overview and User Guide</a><a href="/infrastructure/open-webui/">Infrastructure Explanation</a><a href="/admin-guide/open-webui/">Deployment and Admin Guide</a></nav>

Open WebUI is the browser interface for chatting with configured AI models and working with uploaded knowledge. It can connect to compatible model services such as LiteLLM. The web interface does not host a model by itself, and the models available to a user depend on administrator connections and permissions.

## Access and audience

The public address is defined by `OPEN_WEBUI_HOST` in `apps/variables.yaml`. Use your deployment’s value; Antalos hostnames are examples for a fork.

## Your first workflow

1. Open the AI site and sign in with the configured Authentik provider. A newly provisioned account may need administrator approval or a role assignment.

2. Choose an available model and start a short conversation. Model names represent administrator-configured endpoints and may have different capabilities.

3. Attach a document only when the selected model and workspace allow it. Read the configured provider’s data-handling terms before sending sensitive material.

4. Use separate conversations or workspaces for different projects. Review generated answers against original documents and external evidence.

## When you need an administrator

If browser login succeeds but callbacks fail, compare the OIDC redirect and discovery URL. If uploads fail, inspect S3 access. If streams or replicas disagree, inspect Redis Sentinel authentication and the shared application key before increasing replicas.

## Availability when using this service

**Partially HA: steady-state replicas exist, but Recreate upgrades and Redis/storage dependencies can interrupt all users.** One app, one database member, one Redis data member, and two Sentinel voters can remain. Sustained inference throughput depends on the model provider and surviving app capacity.

Read [how redundancy and recovery work](/infrastructure/open-webui/#availability-and-failure-behavior), including upgrade interruptions and external dependencies. These are design expectations, not a live status indicator.

## Official documentation

Use the [official Open WebUI documentation](https://docs.openwebui.com/) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/open-webui/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/open-webui/).
