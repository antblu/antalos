---
title: "Homelable · Architecture"
description: "A persistent infrastructure map on Debian Arc, outside the Kubernetes cluster."
---

<nav class="guide-switcher" aria-label="Homelable guide sections"><a href="/user-guide/homelable/">Use</a><a aria-current="page" href="/infrastructure/homelable/">Architecture</a><a href="/admin-guide/homelable/">Operate</a></nav>

Homelable runs as a separate Docker Compose project on Debian Arc (`10.30.0.28`), under `/opt/compose/homelable`. The backend, frontend and MCP images are pinned to `3.5.1`. Configuration belongs to `infrastructure/ansible/arcansible/homelable/`; `homelable.yml` deploys only this project and the full `site.yml` imports it. The Debian Left Caddy project owns the HTTPS route.

## Traffic and identity

`homelable.antblu.net` resolves internally to Debian Left (`10.30.0.27`). Caddy terminates trusted HTTPS and forwards HTTP and WebSockets to Arc port 3000. The frontend proxies API requests to `host.docker.internal:8000`.

The backend uses host networking for discovery, but Uvicorn binds to `172.17.0.1:8000`, Docker's host-side address, rather than the LAN or all interfaces. Frontend and MCP use their own Docker bridge. MCP publishes container port 8001 as **loopback port 8002**, avoiding Storyteller's existing LAN port 8001. Use SSH forwarding for trusted MCP clients. No WAN forwarding or public DNS record is added by this project.

Browser authentication is exclusively Authentik OIDC: confidential client `homelable`, scopes `openid profile email`, callback `https://homelable.antblu.net/api/v1/auth/oidc/callback`, secure session cookies, eight-hour sessions and a restricted browser origin. There is no effective default `admin/admin` login. Provider/application configuration is stored in Authentik's database and must be included in its recovery set; it is not created by the Compose playbook.

## Discovery boundaries

Arc has a single Layer-2 attachment to VLAN 30. The scanner uses `NET_RAW` without privileged mode. MAC discovery is possible on VLAN 30; VLANs 20 and 40 are routed and normally provide IP/service discovery without MAC addresses. Proxmox can supply guest MAC addresses independently through its API.

The configured ranges are `10.20.0.0/24`, `10.30.0.0/24` and `10.40.0.0/24`. OPNsense has source-specific rules on its internal interface allowing `10.30.0.28` TCP and ICMP to these two routed subnets, plus UDP DNS on port 53. One additional router rule allows ICMP from VLAN 30 to the Juniper management address only. The Juniper permits ICMP and discards other VLAN 30 traffic on its management interface; see [Rack and Switch Map](/infrastructure/homelable-physical/). Other VLAN isolation rules remain in place. These router settings live in OPNsense's configuration and backup, not in the Kubernetes variables file.

Service detection uses the upstream standard scan plus optional HTTP fingerprinting on a short list of custom ports. It does not continuously scan all 65535 ports. MetalLB VIPs may share a worker's MAC; model them as separate stable logical endpoints rather than interpreting an ARP MAC as a unique service identity.

## Inventory and monitoring

The native Proxmox integration uses `homelable@pve!inventory` with privilege separation and `PVEAuditor` on both user and token at `/`. The API endpoint is `rtx.homelab.local:8006`; the backend maps that certificate name to `10.20.0.6` and trusts the public Proxmox cluster CA in an application-specific CA bundle. TLS verification stays enabled. Hourly sync updates inventory; scanner results and Proxmox guests are correlated by their stable addresses. Physical host management IPs are reconciled explicitly because the upstream importer omits them.

Five network canvases describe the physical/core network, logical VLANs, Proxmox placement, Kubernetes and service categories. The architecture models Talos nodes, VM relationships, important endpoints and VIPs, not ephemeral pods. Unknown scan entries remain pending. The additional **12U Rack** design records workbook-supplied positions and port assignments. See [Rack and Switch Map](/infrastructure/homelable-physical/) for all connections and unresolved patch-panel details.

Status checks run every 60 seconds. Infrastructure uses ping, SSH or a relevant TCP endpoint; web services use their own HTTPS hostname. Upstream HTTP checks accept status codes below 500, including authentication responses and 404s. Treat these as endpoint reachability, not proof of an authenticated user transaction. Real health URLs are used where established.

## Data, documentation and availability

The local Docker volume `antalos-homelable_data` contains `/app/data/homelab.db`, its SQLite side files, `uploads/`, and settings overrides. Credentials live in root-owned `0600` backend/MCP environment files and ignored controller vault inputs. Public sharing keys are not enabled.

Handbook pages are imported with their source paths and a notice that checked-in design differs from live evidence. Important device documents link to related architecture, operational and user guides. The exporter and API importer are explicit operator commands; they update matching objects and do not delete diagrams or blindly approve unknown devices.

This is a **recoverable singleton**. Loss of Arc stops Homelable; loss of Debian Left stops its HTTPS entrypoint; Authentik is needed for new logins. It remains outside the Kubernetes workload failure domain but still depends on the VM hosts and network. No continuous HA or off-host backup is implied. See the [operations runbook](/admin-guide/homelable/) for tested backup and restore procedures.

## Separately collected deployment evidence

On 2026-09-26, all three containers passed health checks; Caddy served HTTPS; native Proxmox import returned three hosts and eleven VMs; all three configured VLANs were reachable and scanned. The initial model contained five canvases, 52 logical service endpoints and imported handbook/device documentation. These are dated deployment observations, not a promise of current health.
