---
title: Understand the antalos stack
description: Repository layout, hosts, network paths, storage, and service availability.
---

Use the repository map to find the files that define each part of antalos. The platform guides cover the hosts, network, and storage those applications depend on.

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

[Nextcloud](/infrastructure/nextcloud/) uses PostgreSQL, Redis, object storage, shared files, and VM companions. [Obsidian](/infrastructure/obsidian/) copies data between two standalone CouchDB instances. [Uptime Kuma](/infrastructure/uptime-kuma/) returns to service by restarting a single process.

## Terms used throughout the guides

| Term | Meaning here |
| --- | --- |
| Desired state | The configuration declared in Git or an infrastructure project |
| Reconciliation | A controller working to make running resources match desired state |
| Replica | Another instance of a process or another copy of its data |
| Quorum | Enough voting members to make a coordinated decision |
| Failure domain | A component whose loss can remove several resources together, such as a physical host |
| HA | High availability for a specified failure, with stated dependencies |
| Recovery | Bringing a service back through restart, repair, or restore after interruption |

When planning for an outage, check whether the surviving workload can reach storage, routing, identity, and any controllers it needs. Check physical placement to see which replicas share a failure domain.
