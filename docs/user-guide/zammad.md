---
title: "Zammad · Use"
description: "What Zammad does, how to use it in antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Zammad guide sections"><a aria-current="page" href="/user-guide/zammad/">Use</a><a href="/infrastructure/zammad/">Architecture</a><a href="/admin-guide/zammad/">Operate</a></nav>

Zammad is a help-desk workspace for tickets, customer conversations, queues, and support history. Agents triage incoming work, reply through configured channels, and track ownership and status. Email ingestion and single sign-on need administrator configuration after the Kubernetes deployment is ready.

## Access and audience

For this installation, use [support.antblu.net](https://support.antblu.net). If you use another antalos installation, open the address supplied by its administrator. Ask for the account or role you need before starting.

## Your first workflow

1. Sign in and open an overview appropriate to your support group, such as unassigned or open tickets.

2. Read the full conversation before replying, assign an owner, and set the correct group and priority.

3. Choose public reply or internal note deliberately. Add enough context for the next agent to continue the conversation.

4. Set the ticket status or pending time according to the workflow. Search existing tickets and knowledge articles before creating duplicate work.

## Get help

Include the ticket identifier, failed action, and time. If a reply may already have been sent, check the ticket history before sending it again. Keep customer information out of public support reports.

## During an interruption

Ticket pages, background processing, and real-time updates can be interrupted independently. Confirm the ticket history before resending a reply.

Administrators can read [the architecture and recovery limits](/infrastructure/zammad/#availability-and-failure-behavior).

## Official documentation

Use the [official Zammad documentation](https://user-docs.zammad.org/en/latest/) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/zammad/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/zammad/).
