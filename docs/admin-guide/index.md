---
title: Deploy and operate Antalos
description: A practical path from an empty environment to a usable, understood, and recoverable Antalos installation.
---

Use this section to deploy your own installation or operate an existing one. Antalos is an environment-specific repository, so begin by understanding its owners and replacing its inputs. Applying the application tree alone does not create the machines, storage server, public DNS, or user accounts.

## Deploy your own stack

| Step | Read and prepare | Outcome before continuing |
| --- | --- | --- |
| 1. Understand the design | [Repository map](/infrastructure/repository/), [hosts](/infrastructure/platform/), and [availability](/infrastructure/availability/) | You know the required machines and the design's failure limits |
| 2. Prepare access and inputs | [Prerequisites](/admin-guide/prerequisites/) and [CLI access](/admin-guide/cli/) | Workstation tools, Proxmox access, network plan, and protected state are ready |
| 3. Prepare external dependencies | [Storage](/infrastructure/storage/) and [networking](/infrastructure/networking/) | Required exports, buckets, DNS ownership, and routing are available |
| 4. Bootstrap Kubernetes and GitOps | [Bootstrap the platform](/admin-guide/bootstrap/) | Talos, Kubernetes, sealing identity, and Argo CD are established |
| 5. Configure application inputs | [Application workflow](/admin-guide/deploy-an-application/) and [sealed credentials](/admin-guide/secrets/) | Manifests use your addresses, supported versions, and credentials |
| 6. Complete a service | Its **Operate** guide in the [directory](/user-guide/services/) | Database initialization, identity, integrations, and a useful user workflow work together |
| 7. Add VM and edge features | [VM lifecycle](/admin-guide/virtual-machines/) and [Azure edge](/admin-guide/azure-edge/) | The selected external backends are configured through their own projects |
| 8. Establish operations | [Routine operations](/admin-guide/operations/) and [recovery](/admin-guide/disaster-recovery/) | You know how to maintain, back up, and restore the installation |

These are dependency stages. They are not a claim that the root app-of-apps automatically waits for every service to become healthy before creating the next one.

## Change an existing installation

Find the owning directory in the [repository map](/infrastructure/repository/). Read the service's architecture and admin guide before changing a database, image, replica count, or integration. A Kubernetes manifest change follows GitOps; a Compose edit follows the matching Ansible playbook; a cloud-init edit affects provisioning.

| Change | Runbook |
| --- | --- |
| Add or configure an application | [Application workflow](/admin-guide/deploy-an-application/) |
| Set up sign-in | [SSO and integrations](/admin-guide/single-sign-on/) |
| Update a Debian workload | [VM lifecycle](/admin-guide/virtual-machines/) |
| Upgrade Nextcloud | [Nextcloud upgrade procedure](/admin-guide/nextcloud-upgrades/) |
| Configure Talk, recording, office, or AI | [Nextcloud integrations](/admin-guide/nextcloud-integrations/) |
| Maintain a worker | [Routine operations](/admin-guide/operations/) |
| Update the handbook | [Write and publish documentation](/admin-guide/site-authoring/) |

## Investigate or recover

Start with [Find the failing layer](/admin-guide/troubleshooting/) for an incident. Use [disaster recovery](/admin-guide/disaster-recovery/) when you need to restore state or reconstruct infrastructure. Read the specific service's recovery section before deleting or recreating resources.

## Use the upstream manuals alongside these guides

Each service guide links to official documentation. Use it for installation prerequisites, supported configuration, and upgrade procedures matching the selected version. Use Antalos documentation for the exact directory, credentials, dependencies, and integration choices made here.
