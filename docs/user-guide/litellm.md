---
title: "LiteLLM · Use"
description: "What LiteLLM does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="LiteLLM guide sections"><a aria-current="page" href="/user-guide/litellm/">Use</a><a href="/infrastructure/litellm/">Architecture</a><a href="/admin-guide/litellm/">Operate</a></nav>

LiteLLM is the shared API gateway for language-model providers. Applications call a consistent API while administrators choose upstream models, create scoped virtual keys, and manage access. Installing the gateway does not supply a model or a provider account; those must be configured after deployment.

## Access and audience

For this installation, use [litellm.antblu.net](https://litellm.antblu.net). If you use another Antalos installation, open the address supplied by its administrator. Ask for the account or role you need before starting.

## Your first workflow

1. Ask an administrator for the gateway API base URL, an allowed model alias, and a virtual key scoped to your application.

2. Configure your client’s compatible API base URL as `https://<litellm-host>/v1`. Store its key using your application’s credential mechanism.

3. Send a small request before enabling long jobs or streaming. Use the model alias registered in this gateway, which may differ from the provider’s original model name.

4. Treat authentication failures, budget limits, and upstream availability as separate conditions. Record request identifiers when asking an administrator to investigate.

## Get help

Include the model alias, endpoint, time, and redacted error. A rejected key, an unavailable model, and an exhausted provider limit need different fixes. Do not share your API key.

## During an interruption

The API gateway and individual model providers can fail independently. Report the model and error, and check whether a failed request already produced a result before resubmitting it.

Administrators can read [the architecture and recovery limits](/infrastructure/litellm/#availability-and-failure-behavior).

## Official documentation

Use the [official LiteLLM documentation](https://docs.litellm.ai/docs/) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/litellm/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/litellm/).
