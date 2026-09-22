---
title: Understand the antalos stack
description: Read the repository, follow service dependencies, and understand the boundaries of availability.
---

antalos combines several systems with different owners. Start with the repository map, then follow the machines, network, and data before reading an individual application's design.

## Read the architecture in order

| Guide | What you will understand |
| --- | --- |
| [Repository and ownership](/infrastructure/repository/) | Which directory changes machines, Kubernetes resources, VM workloads, or this website |
| [Hosts and Talos](/infrastructure/platform/) | How the physical hosts, control plane, workers, and quorum placement fit together |
| [Traffic, DNS, and TLS](/infrastructure/networking/) | How the Azure edge, home HAProxy pair, MetalLB, Traefik, and application listeners connect |
| [Storage and data](/infrastructure/storage/) | Where databases, files, objects, and recoverable SQLite state live |
| [Debian application VMs](/infrastructure/virtual-machines/) | Which features run outside Kubernetes and how Ansible owns them |
| [Availability and failure domains](/infrastructure/availability/) | What replicas protect and which shared dependencies can still interrupt a service |

## Read an application's design

Use the **Architecture** link in the [service directory](/user-guide/services/). Each service guide describes its components, state, and failure behavior. The neighboring **Use** and **Operate** guides explain user impact and administrator actions.

For a first example, [Nextcloud](/infrastructure/nextcloud/) shows a web application with PostgreSQL, Redis, object storage, shared files, and VM companions. [Obsidian](/infrastructure/obsidian/) shows why two database processes do not necessarily form a synchronous cluster. [Uptime Kuma](/infrastructure/uptime-kuma/) shows the difference between a restartable singleton and a ready replica.

## Terms used throughout the guides

| Term | Meaning here |
| --- | --- |
| Desired state | The configuration declared in Git or an infrastructure project |
| Reconciliation | A controller working to make running resources match desired state |
| Replica | Another process or data copy; the guide states which |
| Quorum | Enough voting members to make a coordinated decision |
| Failure domain | A component whose loss can remove several resources together, such as a physical host |
| HA | High availability for a specified failure, with stated dependencies |
| Recovery | Bringing a service back through restart, repair, or restore after interruption |

A workload's replica count is one part of its design. Storage, routing, identity, controller access, and physical placement determine whether the user can still complete a task.
