---
title: Deploy the Azure edge and home proxies
description: Configure the edge template, its private transport, and the actual forwarding path into Antalos.
---

The Azure VM is an edge TCP proxy. It accepts selected public connections and forwards them over the private network to the home HAProxy pair. The home proxies forward onward to the appropriate Kubernetes listener. Read [the network architecture](/infrastructure/networking/) before provisioning or changing this path.

## Configuration ownership

| File or project | Purpose |
| --- | --- |
| `infrastructure/azure/cloud-init.yaml` | Committed Debian ARM64 provisioning template |
| `infrastructure/azure/variables.yaml` | Non-secret OS, identity, listener allowlist, and backend inputs |
| `infrastructure/azure/secrets.example.yaml` | Required shape for local secret inputs |
| `infrastructure/azure/secrets.yaml` | Ignored local enrollment credential |
| `infrastructure/azure/cloud-init.rendered.yaml` | Ignored, sensitive user data supplied to Azure |
| `infrastructure/opentofu/haproxy/` | Home VM pair, Keepalived, HAProxy, and private-network enrollment |

The template itself does not contain the enrollment key. Rendering combines it with the local secret file, so the rendered output must be treated as a credential. VM settings stay in these infrastructure projects rather than `apps/variables.yaml`.

## Prepare the private path

Prepare Headscale access before enrolling the Azure node. The home HAProxy template resolves the Headscale hostname to the internal Traefik address so its own enrollment does not depend on a tunnel that has not started.

The current Azure variables select the two home backends by Tailscale address. Use the identities allocated in your installation; do not assume the example addresses follow a replacement VM. Check the expected Headscale enrollment and routing policy when preparing the deployment.

Home HAProxy also declares a floating external-network address. Azure's two individually configured backends do not become a single VIP merely because Keepalived exists on those guests.

## Render the Azure user data

Read `infrastructure/azure/README.md`. Install Mike Farah `yq` v4 and GNU `envsubst`, then work from the Azure directory. For a new local secret file:

```bash title="Prepare private edge inputs"
cd infrastructure/azure
umask 077
cp secrets.example.yaml secrets.yaml
chmod 600 secrets.yaml
```

Edit `secrets.yaml` privately and replace the example enrollment key. Edit `variables.yaml` for your hostname, administrator public key, architecture, Headscale URL, backend addresses, and allowed ports. For an existing secret file, edit it without copying over it.

Use an explicit substitution list so runtime variables in the embedded shell remain intact:

```bash title="Render from the Azure directory"
umask 077
set -a
eval "$(yq -o=shell '.' variables.yaml)"
eval "$(yq -o=shell '.' secrets.yaml)"
set +a

variable_names="$({ yq -r 'keys | .[]' variables.yaml; yq -r 'keys | .[]' secrets.yaml; } | sort -u)"
substitutions="$(printf '${%s} ' ${variable_names})"
envsubst "$substitutions" < cloud-init.yaml > cloud-init.rendered.yaml
chmod 600 cloud-init.rendered.yaml
```

Run this only against your own trusted configuration files. Do not print or commit the rendered output. Supply it as the new Azure VM's custom data. The template prepares the guest firewall, installs CrowdSec before the firewall bouncer, joins the private network, and starts HAProxy.

Cloud-init is a provisioning mechanism. Editing the template does not update a running guest. Plan an explicit guest configuration update or a replacement when needed; do not assume that another OpenTofu apply reruns first-boot configuration.

## Match the ports at every boundary

| TCP port | Azure guest allowlist | Azure HAProxy template | Home HAProxy defaults |
| --- | --- | --- | --- |
| 22 | Allowed for administration | No service forwarding | Separate administration path |
| 25 | Allowed | SMTP forwarding | Stalwart forwarding |
| 443 | Allowed | HTTPS forwarding | Traefik forwarding |
| 465 | Allowed | Mail submission forwarding | Stalwart forwarding |
| 587 | Allowed | No listener declared | Stalwart forwarding |
| 993 | Allowed | IMAPS forwarding | Stalwart forwarding |
| 4190 | Allowed | No listener declared | Stalwart forwarding |

The UDP allowlist includes the configured Tailscale port. Azure NSG, public DNS, router rules, and home network policy are separate configuration. Permitting a port does not create its proxy frontend, backend, Kubernetes Service, or application listener.

For 587 or 4190 through Azure, the missing proxy listeners are a source prerequisite in addition to the other layers. This guide documents that gap; it does not change the edge deployment or assert those ports currently work.

## Complete deployment

1. Establish the intended Azure NSG and public DNS for your installation.
2. Provision using the rendered user data and confirm guest initialization completes.
3. Confirm Azure can reach each configured private backend on each declared forwarding port.
4. Confirm each home backend reaches the Kubernetes address and the correct service listener.
5. Exercise the public protocol: HTTPS response, mailbox login, or SMTP transaction as appropriate.
6. Record the resulting DNS, private backend identities, and recovery procedure with the private infrastructure inventory.

A TCP connection to the first proxy does not prove the downstream TLS handshake or mail transaction succeeds. Outbound relay access from Stalwart is a separate path. Use [mail operations](/admin-guide/stalwart/) for that investigation.

## Maintain the two security systems separately

Azure's CrowdSec engine processes guest events and its nftables bouncer applies decisions at the guest firewall. The [Kubernetes CrowdSec installation](/admin-guide/crowdsec/) uses its own LAPI, log source, and Traefik integration. Updating one does not configure the other.

Keep VM recreation, reboots, storage changes, and disruptive network changes within the repository's approval requirements. Preserve enrollment credentials and private provisioning state in the external recovery set.
