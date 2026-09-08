---
title: "Antalos, explained."
description: "A practical handbook for the applications, infrastructure, and operations of the Antalos Kubernetes platform."
---

Antalos brings a collection of self-hosted services onto a Talos Kubernetes platform, managed through OpenTofu and Argo CD. This handbook connects everyday use to the infrastructure and operational work behind it.

Choose a guide based on what you want to accomplish. Every deployed application and platform service has a matching page in each of the three sections.

<div class="guide-cards">
<a class="guide-card" href="/user-guide/"><span class="card-number">01 / USE</span><strong>Overview and User Guide</strong><span>Find the right tool, complete your first workflow, and explore the official manuals.</span></a>
<a class="guide-card" href="/infrastructure/"><span class="card-number">02 / UNDERSTAND</span><strong>Infrastructure Explanation</strong><span>Follow the request path, locate persistent state, and understand what happens when a node fails.</span></a>
<a class="guide-card" href="/admin-guide/"><span class="card-number">03 / OPERATE</span><strong>Deployment and Admin Guide</strong><span>Build from the manifests, finish identity and integrations, and maintain a recoverable installation.</span></a>
</div>

## Start with a task

| I want to… | Start here |
| --- | --- |
| Sign in or request access | [Accounts and access](/user-guide/accounts/) |
| Store and collaborate on files | [Nextcloud](/user-guide/nextcloud/) |
| Host code and review changes | [GitLab](/user-guide/gitlab/) |
| Use AI models | [Open WebUI](/user-guide/open-webui/) or [LiteLLM](/user-guide/litellm/) |
| Connect devices privately | [Headscale](/user-guide/headscale/) |
| Help someone remotely | [RustDesk](/user-guide/rustdesk/) |
| Understand a failure boundary | [Platform topology](/infrastructure/platform/) and [availability](/infrastructure/availability/) |
| Deploy my own installation | [Workstation prerequisites](/admin-guide/prerequisites/) and [bootstrap](/admin-guide/bootstrap/) |
| Recover a service | Its deployment guide, then [disaster recovery](/admin-guide/disaster-recovery/) |

## How the platform fits together

<figure class="architecture-diagram" aria-label="From infrastructure to a useful service">
<div class="diagram-heading">From infrastructure to a useful service</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Provision</span><ul><li>Proxmox virtual machines</li><li>OpenTofu → Talos / Kubernetes</li></ul></li><li class="diagram-stage"><span class="diagram-label">Reconcile</span><ul><li>Git → Argo CD</li><li>Rendered app manifests</li></ul></li><li class="diagram-stage"><span class="diagram-label">Serve</span><ul><li>Ingress → applications</li><li>Databases / NFS / objects</li></ul></li></ol>
<figcaption>OpenTofu owns the machine lifecycle. Argo CD owns application desired state. Data recovery requires the storage and credentials behind those applications.</figcaption>
</figure>

## Read configuration as configuration

These guides describe the checked-in manifests, not a live health report. Two replicas can protect a process while its external storage remains a shared dependency. Each infrastructure guide explains that boundary instead of using a blanket high-availability claim.

Hostnames, image and chart versions, node names, and storage sizes are maintained in `apps/variables.yaml`. When deploying a fork, replace the environment-specific values and complete the provider, DNS, storage, and credential setup described in the administrator guides.
