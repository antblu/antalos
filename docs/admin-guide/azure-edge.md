---
title: "Azure edge proxy"
description: "Bootstrap the Debian Azure proxy and route TCP traffic to the home HAProxy VMs."
---

The private `infrastructure/azure/cloud-init.yaml` file is the Debian 13 ARM64 Azure VM user data. It creates the `antblu` SSH account, installs nftables, CrowdSec with the nftables firewall bouncer, Tailscale for Headscale, and HAProxy. Its external APT repositories are limited to `arm64`, and the bootstrap stops if the guest uses another architecture. The file contains a Headscale authentication key and is ignored by Git. Treat the Azure custom data copy as a secret as well.

The home HAProxy VMs join Headscale and advertise their own addresses as `10.40.0.17/32` and `10.40.0.18/32`. Both routes were approved in Headscale. The Azure Tailscale client accepts those routes and connects to each home VM independently. The Headscale control endpoint at `vpn.antblu.net` remains on the home public IP over TCP 443, so Azure can reach it without the tunnel, including during reconnection. Replacing either home VM requires a valid Headscale pre-authentication key through the sensitive OpenTofu `headscale_auth_key` variable and approval of the replacement node's route. The key is not kept in tracked source files; supplying it to OpenTofu will put it in the private state and Proxmox cloud-init snippet.

Allow inbound TCP 22, 443, 465, and 993 plus UDP 41641 in the Azure network security group. The guest nftables policy allows those ports and established traffic. CrowdSec owns the blacklist sets used by the guest firewall; its local engine reads SSH journal events and its firewall bouncer applies local and community decisions. HAProxy passes the three TCP streams through without terminating TLS.

The Azure proxy distributes each port across both home HAProxy VMs. The home VM cloud-init template sends 443 to Traefik and 465 and 993 to Stalwart. Both services share the MetalLB address `10.30.0.200` on different ports. Updating the OpenTofu template or cloud-init snippet does not rerun cloud-init on an existing VM. Both running home HAProxy configurations were updated separately on September 18, 2026; the template supplies the same listeners when those VMs are replaced.

Azure reached both home HAProxy VMs on 443, 465, and 993 after route approval. Before cutover, confirm an external connection on each public port. The Azure network security group and public DNS are managed outside this cloud-init file.

The home firewall must allow TCP 465 and 993 from `10.40.0.17` and `10.40.0.18` to `10.30.0.200`. Both home HAProxy VMs already reach that address on 443 but time out on the mail ports. Until those rules are active, Azure accepts mail connections but cannot complete the TLS handshake to Stalwart.
