---
title: "Zammad \u00b7 Overview and User Guide"
description: "What Zammad does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Zammad guide sections"><a aria-current="page" href="/user-guide/zammad/">Overview and User Guide</a><a href="/infrastructure/zammad/">Infrastructure Explanation</a><a href="/admin-guide/zammad/">Deployment and Admin Guide</a></nav>

Zammad is a help-desk workspace for tickets, customer conversations, queues, and support history. Agents triage incoming work, reply through configured channels, and track ownership and status. Email ingestion and single sign-on need administrator configuration after the Kubernetes deployment is ready.

## Access and audience

The public address is defined by `ZAMMAD_HOST` in `apps/variables.yaml`. Use your deployment’s value; Antalos hostnames are examples for a fork.

## Your first workflow

1. Sign in and open an overview appropriate to your support group, such as unassigned or open tickets.

2. Read the full conversation before replying, assign an owner, and set the correct group and priority.

3. Choose public reply or internal note deliberately. Add enough context for the next agent to continue the conversation.

4. Set the ticket status or pending time according to the workflow. Search existing tickets and knowledge articles before creating duplicate work.

## When you need an administrator

If Argo remains Progressing while Rails serves traffic, inspect the current init Job, ownerReferences, and hook status. For missing email, inspect scheduler and channel errors. For search failures, inspect Elasticsearch quorum and indexing separately from ticket storage.

## Official documentation

Use the [official Zammad documentation](https://user-docs.zammad.org/en/latest/) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/zammad/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/zammad/).
