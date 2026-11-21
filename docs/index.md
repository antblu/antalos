---
title: antalos Documentation
description: Service guides, infrastructure reference, and deployment runbooks for antalos.
---

Use antalos as a template for hosting applications on a Talos Kubernetes cluster and Debian VMs. An edge network connects the services to their users.

<div class="guide-cards">
<a class="guide-card" href="/user-guide/"><span class="card-number">01 / USE</span><strong>I want to use a service</strong><span>Find an application, sign in, and complete a first task. Follow official manuals for deeper product help.</span></a>
<a class="guide-card" href="/infrastructure/"><span class="card-number">02 / UNDERSTAND</span><strong>I want to understand the stack</strong><span>Follow traffic from the edge to an application, locate its data, and see what a failure affects.</span></a>
<a class="guide-card" href="/admin-guide/"><span class="card-number">03 / OPERATE</span><strong>I want to deploy or administer it</strong><span>Prepare dependencies, choose the right configuration files, and follow deployment and recovery runbooks.</span></a>
</div>

## I’ll set up your apps and show you how to run them

<ul class="service-conversation" role="list" aria-label="Example conversation about app setup and training">
<li class="service-question"><strong>You</strong><p>I want to host my own apps. Can you set up everything my team needs?</p></li>
<li><strong>Antalos</strong><p>Yes. Tell me how your team works and what you need the apps to do. We’ll choose the apps together, and I’ll install and configure them for you.</p></li>
<li class="service-question"><strong>You</strong><p>What happens when an app needs an update or something stops working?</p></li>
<li><strong>Antalos</strong><p>We’ll work through a few real tasks on your setup. I’ll show you how to use AI to understand an error, plan an update, and check that your backups are working. You’ll practice those steps with me so you can repeat them on your own.</p></li>
</ul>

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
<figcaption>Argo CD reconciles Kubernetes from Git. Run the relevant Ansible playbook for Debian workloads and use the Azure project to provision the edge.</figcaption>
</figure>

## How to read the handbook

Open the [service directory](/user-guide/services/) for user tasks, architecture, and deployment guides. Start with **Use** if you need to work in an application. Open **Architecture** to locate components and data, or **Operate** for deployment and recovery steps.

The guides describe the design in Git. If you deploy a fork, replace the antalos addresses with your own. Set Kubernetes application values in `apps/variables.yaml`. Set VM and Azure values in their respective infrastructure projects.
