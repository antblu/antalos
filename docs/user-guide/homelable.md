---
title: "Homelable · Use"
description: "Explore Antalos infrastructure, service health and linked handbook documentation."
---

<nav class="guide-switcher" aria-label="Homelable guide sections"><a aria-current="page" href="/user-guide/homelable/">Use</a><a href="/infrastructure/homelable/">Architecture</a><a href="/admin-guide/homelable/">Operate</a></nav>

Open [Homelable](https://homelable.antblu.net) from the internal network and sign in through Authentik.

## Choose the right canvas

- **Physical / Core Network:** router, managed switch, Proxmox hosts and storage. Physical port/cable assignments require verified inventory.
- **Logical Network:** VLANs 20, 30 and 40, routing boundaries and important endpoints.
- **Proxmox:** physical host placement, VMs, resources and host/guest relationships.
- **Kubernetes:** Talos nodes, Proxmox placement, cluster grouping and stable service VIPs.
- **Services:** major applications grouped by function, with their own HTTPS checks.

Devices can appear on multiple canvases while sharing one inventory identity. Logical applications sharing a reverse-proxy IP are separate service objects.

## Read documentation and status

Open a device's documentation to follow linked architecture and runbooks. The Documentation library contains imported Architecture, Operations and User Guides, plus network, Proxmox, Kubernetes, authentication, storage, recovery and service-catalog overviews.

Imported handbook content describes repository design and records its source path. A green HTTP/HTTPS indicator means the endpoint answered according to Homelable's check; it does not prove database correctness, successful login or all application dependencies. Use the existing monitoring systems and service transaction checks for that evidence.

Unknown discovered hosts stay in the pending inventory until their identity is established. Routed VLANs normally have no scanner MAC addresses. Review new findings instead of approving every entry or treating a missing MAC as a failure.

## Rack and switch connections

Open **12U Rack** to view bottom-up U positions and the EX3300’s 28 sockets. Cable labels identify switch ports; select a cable for VLAN, mode and link information. The physical/core network canvas also shows devices whose rack locations are unspecified. See [Rack and Switch Map](/infrastructure/homelable-physical/) for the workbook source, complete mapping and the NAS VLAN discrepancy. **Retired services** retains ytdlp2strm’s documentation with monitoring disabled.
