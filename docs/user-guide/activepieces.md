---
title: Activepieces · Use
description: Build and understand your first automation, with links to the official product guide.
---

<nav class="guide-switcher" aria-label="Activepieces guides"><a aria-current="page" href="/user-guide/activepieces/">Use</a><a href="/infrastructure/activepieces/">Architecture</a><a href="/admin-guide/activepieces/">Operate</a></nav>

Activepieces connects applications into a flow: something triggers it, then it performs the actions you configured. Use it to automate a repeated task and inspect what happened during each run.

## Open Activepieces

Open [Activepieces](https://flows.antblu.net) for this installation, or the address your administrator supplied. Sign in through Authentik, then use your Activepieces account and workspace access. Ask for access to the appropriate workspace and connected accounts. An integration needs its own permission to act in the connected service.

## Create a first flow

1. Choose a small task and use sample data you can recognize.
2. Create a flow with the trigger that matches the task, such as an incoming webhook or a schedule.
3. Add an action and authorize the required connection. Review which account it will use.
4. Test the flow and inspect each step's inputs and outputs before enabling repeated execution.
5. Publish or enable it using the controls in your installed version, then check the run history after the trigger occurs.

See the [official Activepieces guide](https://www.activepieces.com/docs/overview/welcome) for the product concepts and supported features. Available integrations and features depend on the installed version and edition.

## Get help with a failed run

Give the administrator the flow name, run time, failed step, and redacted error. A flow that never starts, a failed connection, and an action rejected by another service are different problems. Inspect the destination before retrying an action that creates records or sends messages.

## What an interruption means

A temporary outage can delay work or interrupt an active run. Multiple workers do not guarantee that every action happens exactly once. Review the run and its destination before manually repeating it.

## Official documentation

Use [Activepieces documentation](https://www.activepieces.com/docs/overview/welcome) for flow building and product help. Administrators should also read the [self-hosting options](https://www.activepieces.com/docs/install/overview) and the [antalos deployment guide](/admin-guide/activepieces/).
