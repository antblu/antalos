---
title: The antalos handbook
description: Use the services, understand the infrastructure, and deploy your own antalos stack.
---

antalos is a self-hosted platform built from a Talos Kubernetes cluster, Debian application VMs, and an edge network. This handbook explains what you can use, where it runs, and how to build and maintain it from this repository.

<div class="guide-cards">
<a class="guide-card" href="/user-guide/"><span class="card-number">01 / USE</span><strong>I want to use a service</strong><span>Find an application, sign in, and complete a first task. Follow official manuals for deeper product help.</span></a>
<a class="guide-card" href="/infrastructure/"><span class="card-number">02 / UNDERSTAND</span><strong>I want to understand the stack</strong><span>Follow traffic from the edge to an application, locate its data, and see what a failure affects.</span></a>
<a class="guide-card" href="/admin-guide/"><span class="card-number">03 / OPERATE</span><strong>I want to deploy or administer it</strong><span>Prepare dependencies, choose the right configuration files, and follow deployment and recovery runbooks.</span></a>
</div>

## Find what you need

| Your task | Start here |
| --- | --- |
| Find an application and its guides | [Service directory](/user-guide/services/) |
| Sign in or request access | [Accounts and access](/user-guide/accounts/) |
| Learn how this repository is organized | [Repository and ownership](/infrastructure/repository/) |
| Deploy antalos in another environment | [Deployment path](/admin-guide/#deploy-your-own-stack) |
| Understand which services survive a failure | [Availability and failure domains](/infrastructure/availability/) |
| Diagnose an unavailable application | [Find the failing layer](/admin-guide/troubleshooting/) |
| Update these pages | [Write and publish documentation](/admin-guide/site-authoring/) |

## One repository, several deployment paths

<figure class="architecture-diagram" aria-label="antalos deployment responsibilities">
<div class="diagram-heading">Choose the owner before changing a service</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Machines</span><ul><li>Proxmox + OpenTofu</li><li>Talos and Debian guests</li><li>Home HAProxy pair</li></ul></li><li class="diagram-stage"><span class="diagram-label">Workloads</span><ul><li>Argo CD → Kubernetes apps</li><li>Ansible → Debian Compose</li><li>Cloud-init → Azure edge</li></ul></li><li class="diagram-stage"><span class="diagram-label">Dependencies</span><ul><li>Identity and public DNS</li><li>NFS and Garage objects</li><li>Credentials and backups</li></ul></li></ol>
<figcaption>Each deployment path has its own configuration and lifecycle. A Git change reaches Kubernetes through Argo CD; VM playbooks and Azure provisioning follow separate procedures.</figcaption>
</figure>

## How to read the handbook

User guides explain tasks without requiring Kubernetes knowledge. Architecture guides describe the components and state behind those tasks. Admin guides connect repository files to deployment steps and operational decisions. Every service in the [directory](/user-guide/services/) links to all three perspectives.

The guides describe the checked-in design. They do not report live health. Addresses identify the antalos environment; administrators deploying a fork must supply their own. Application values belong in `apps/variables.yaml`, while VM and Azure settings belong to their respective infrastructure projects.
