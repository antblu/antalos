---
title: "LiteLLM \u00b7 Overview and User Guide"
description: "What LiteLLM does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="LiteLLM guide sections"><a aria-current="page" href="/user-guide/litellm/">Overview and User Guide</a><a href="/infrastructure/litellm/">Infrastructure Explanation</a><a href="/admin-guide/litellm/">Deployment and Admin Guide</a></nav>

LiteLLM is the shared API gateway for language-model providers. Applications call a consistent API while administrators choose upstream models, create scoped virtual keys, and manage access. Installing the gateway does not supply a model or a provider account; those must be configured after deployment.

## Access and audience

The public address is defined by `LITELLM_HOST` in `apps/variables.yaml`. Use your deployment’s value; Antalos hostnames are examples for a fork.

## Your first workflow

1. Ask an administrator for the gateway API base URL, an allowed model alias, and a virtual key scoped to your application.

2. Configure your client’s compatible API base URL as `https://<litellm-host>/v1`. Store its key using your application’s credential mechanism.

3. Send a small request before enabling long jobs or streaming. Use the model alias registered in this gateway, which may differ from the provider’s original model name.

4. Treat authentication failures, budget limits, and upstream availability as separate conditions. Record request identifiers when asking an administrator to investigate.

## When you need an administrator

If rollout is blocked, inspect `litellm-migrations` before the proxy logs. A Redis `MasterNotFoundError` requires checking all Sentinel endpoints and authentication. A working UI with failing requests usually needs model/provider, permission, quota, or upstream investigation.

## Official documentation

Use the [official LiteLLM documentation](https://docs.litellm.ai/docs/) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/litellm/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/litellm/).
