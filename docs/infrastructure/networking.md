---
title: Traffic, DNS, and TLS
description: Follow public and private traffic through Azure, home HAProxy, Kubernetes ingress, and application listeners.
---

Traffic passes through several independently configured layers. A service's hostname, load-balancer address, and listening application process must agree before the user can connect.

## The public web path

<figure class="architecture-diagram" aria-label="Public HTTPS request path">
<div class="diagram-heading">HTTPS through the Azure edge</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Public entry</span><ul><li>DNS → Azure public address</li><li>Azure NSG + guest firewall</li><li>HAProxy passes TCP</li></ul></li><li class="diagram-stage"><span class="diagram-label">Private transport</span><ul><li>Headscale / Tailscale</li><li>Home HAProxy pair</li><li>Forward to MetalLB address</li></ul></li><li class="diagram-stage"><span class="diagram-label">Kubernetes</span><ul><li>Traefik terminates HTTPS</li><li>Optional Authentik middleware</li><li>Service → application pod</li></ul></li></ol>
<figcaption>This is the configured edge path, not a live DNS report. Other direct or private routes must be documented by their own entrypoint.</figcaption>
</figure>

Azure's backend addresses come from `infrastructure/azure/variables.yaml` and currently identify the home proxies by their Tailscale addresses. The home pair also has an external-network Keepalived VIP declared in the HAProxy OpenTofu project. Azure's two-backend configuration and the home VIP are separate routing mechanisms.

## Know the addresses by role

| Address or network | Role | Source |
| --- | --- | --- |
| `10.30.0.0/24` | Internal machine network | Talos and VM OpenTofu inputs |
| `10.40.0.17`, `10.40.0.18` | Home HAProxy external identities | `infrastructure/opentofu/haproxy/variables.tf` |
| `10.40.0.20` | Home HAProxy floating address | Same HAProxy project |
| `10.30.0.200` | Shared Kubernetes ingress/mail address | Application variables and corresponding proxy inputs |
| `10.244.0.0/16` | Pod network | Cluster configuration |
| `10.30.0.241` | Declared Talk TURN address | Application variables and Talk services |

These are values for this environment. Match the settings at each boundary when deploying a fork; updating application variables does not rewrite the separate Azure or home-proxy projects.

## Web traffic and mail take different paths

| Traffic | Final listener | What must be configured |
| --- | --- | --- |
| HTTPS on 443 | Traefik, then the selected web service | DNS, forwarding, ingress route, certificate, and optional authentication |
| SMTP on 25 | Stalwart | Edge forwarding, mail Service, active SMTP listener, and mail-domain DNS |
| Submission on 465 or 587 | Stalwart | Listener encryption/authentication settings and a working mail-client account |
| IMAPS on 993 | Stalwart | TLS listener and mailbox credentials |
| ManageSieve on 4190 | Stalwart | Matching listener, network exposure, and supported client |
| Talk media / TURN | Talk's declared endpoints | The separate TCP/UDP routing in the [Talk runbook](/admin-guide/nextcloud-talk/) |

The home HAProxy defaults include 443 and all listed mail TCP ports. Azure’s cloud-init currently creates listeners for 443, 25, 465, and 993. Its firewall allowlist also names 587 and 4190, but no HAProxy listeners for those two ports are declared in that template. An allowed port is not a forwarded service. Neither project establishes the external NSG, router, or DNS configuration. The home template's LDAPS forwarding entry is commented out; it is not an enabled public listener simply because an application can use LDAP internally.

Outbound SMTP delivery has its own path from Stalwart to the recipient or relay. A successful inbound TLS connection does not establish outbound reachability. See [mail operations](/admin-guide/stalwart/).

## DNS and certificates

Public DNS directs clients to the chosen entrypoint. Cluster DNS resolves Services and internal peers. Headscale's control hostname must remain reachable while its tunnel is starting; the home HAProxy template supplies an internal resolution for that hostname to avoid a circular dependency.

cert-manager requests the certificates referenced by application ingress. `letsencrypt-prod` is the configured issuer. A valid certificate proves the hostname and TLS setup, while application readiness still depends on the downstream service. Read [cert-manager administration](/admin-guide/cert-manager/) for its source-rendering caveat.

## Authentication is a separate hop

Native OIDC/SAML makes the application participate in sign-in. Forward-auth asks Authentik whether an incoming request may proceed. These methods have different callback and client requirements. A browser can complete a redirect that a database replication client or a webhook cannot.

[Obsidian](/infrastructure/obsidian/) adds a signed CouchDB identity after Authentik authorization. Mail clients use their supported mail authentication. Configure each service's method rather than putting a browser challenge in front of every protocol.

## Where to operate each layer

Use [Azure edge and home proxies](/admin-guide/azure-edge/) for provisioning, [Traefik](/admin-guide/traefik/) for HTTP routing, [MetalLB](/admin-guide/metallb/) for address advertisement, and [troubleshooting](/admin-guide/troubleshooting/) to isolate the failing hop. The presence of two proxies does not duplicate the Azure VM, physical network, or storage behind them.
