---
title: "Zammad · Use"
description: "Triage tickets, reply through configured channels, and track ticket history."
---

<nav class="guide-switcher" aria-label="Zammad guide sections"><a aria-current="page" href="/user-guide/zammad/">Use</a><a href="/infrastructure/zammad/">Architecture</a><a href="/admin-guide/zammad/">Operate</a></nav>

Zammad is a help-desk workspace for tickets, customer conversations, queues, and support history. Agents triage incoming work, reply through configured channels, and track ownership and status. Email ingestion and single sign-on need administrator configuration after the Kubernetes deployment is ready.

## Access

Open [support.antblu.net](https://support.antblu.net) or use the address your administrator gave you. Ask your administrator for access if you need an account or role.

## Triage and reply to a ticket

1. Sign in and open an overview appropriate to your support group, such as unassigned or open tickets.

2. Read the full conversation before replying, assign an owner, and set the correct group and priority.

3. Use a public reply to answer the customer. Use an internal note to leave context for the next agent.

4. Set the ticket status or pending time according to the workflow. Search existing tickets and knowledge articles before creating duplicate work.

## Get help

Include the ticket identifier, failed action, and time. If a reply may already have been sent, check the ticket history before sending it again. Keep customer information out of public support reports.

## During an interruption

Ticket pages, background processing, and real-time updates can be interrupted independently. Confirm the ticket history before resending a reply.

See [expected failure behavior and recovery](/infrastructure/zammad/#availability-and-failure-behavior).

## Official documentation

Use the [official Zammad documentation](https://user-docs.zammad.org/en/latest/) for your installed version. Ask your administrator which optional features are enabled.

See the [architecture](/infrastructure/zammad/) or [deployment guide](/admin-guide/zammad/).
