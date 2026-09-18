---
title: "Azure edge proxy"
description: "Bootstrap the Debian Azure proxy and route TCP traffic to the home HAProxy VMs."
---

The private `infrastructure/azure/cloud-init.yaml` file is the Debian 13 ARM64 Azure VM user data. It creates the `antblu` SSH account, installs nftables, CrowdSec with the nftables firewall bouncer, Tailscale for Headscale, and HAProxy. Its external APT repositories are limited to `arm64`, and the bootstrap stops if the guest uses another architecture. The file contains a Headscale authentication key and is ignored by Git. Treat the Azure custom data copy as a secret as well.

Before changing public DNS, provide an approved Headscale subnet route to `10.40.0.0/24` from a home subnet router. The Azure Tailscale client accepts routes and connects to the home HAProxy VMs at `10.40.0.17` and `10.40.0.18`. The Headscale control endpoint at `vpn.antblu.net` remains on the home public IP over TCP 443, so Azure can reach it without the tunnel, including during reconnection.

Allow inbound TCP 22, 443, 465, and 993 plus UDP 41641 in the Azure network security group. The guest nftables policy allows those ports and established traffic. CrowdSec owns the blacklist sets used by the guest firewall; its local engine reads SSH journal events and its firewall bouncer applies local and community decisions. HAProxy passes the three TCP streams through without terminating TLS.

The Azure proxy distributes each port across both home HAProxy VMs. The home VM cloud-init template sends 443 to Traefik and 465 and 993 to Stalwart. Both services share the MetalLB address `10.30.0.200` on different ports. Updating the OpenTofu template or cloud-init snippet does not rerun cloud-init on an existing VM. Both running home HAProxy configurations were updated separately on September 18, 2026; the template supplies the same listeners when those VMs are replaced.

Before cutover, confirm the approved Headscale route, both home listeners, Azure service startup, and an external connection on each port. The Azure network security group and public DNS are managed outside this cloud-init file.
