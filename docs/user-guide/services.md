---
title: Service directory
description: Find every declared antalos application by purpose, with user, architecture, and operating guides in one place.
---

Use this directory to move between a service's three guides. **Use** explains the workflow, **Architecture** locates its components and data, and **Operate** explains deployment and recovery. The sidebar uses these same groups.

These entries describe service definitions in Git. They do not report current deployment health or automatically grant access. Start with [accounts and access](/user-guide/accounts/) for sign-in.

## Files, notes, and communication

| Service | Purpose | Guides | Official manual |
| --- | --- | --- | --- |
| Nextcloud | Files, calendars, collaborative editing, and Talk. | [Use](/user-guide/nextcloud/) · [Architecture](/infrastructure/nextcloud/) · [Operate](/admin-guide/nextcloud/)  [Read the manual](https://docs.nextcloud.com/server/latest/user_manual/en/) |
| Obsidian LiveSync | CouchDB synchronization for local Obsidian vaults. | [Use](/user-guide/obsidian/) · [Architecture](/infrastructure/obsidian/) · [Operate](/admin-guide/obsidian/)  [Read the manual](https://help.obsidian.md/) |
| Stalwart Mail | Mailboxes, submission, delivery, and mail clients. | [Use](/user-guide/stalwart/) · [Architecture](/infrastructure/stalwart/) · [Operate](/admin-guide/stalwart/)  [Read the manual](https://stalw.art/docs/) |

## Work and automation

| Service | Purpose | Guides | Official manual |
| --- | --- | --- | --- |
| Activepieces | Flows, webhooks, connected accounts, and background execution. | [Use](/user-guide/activepieces/) · [Architecture](/infrastructure/activepieces/) · [Operate](/admin-guide/activepieces/)  [Read the manual](https://www.activepieces.com/docs/overview/welcome) |
| GitLab | Source code, reviews, repositories, and CI configuration. | [Use](/user-guide/gitlab/) · [Architecture](/infrastructure/gitlab/) · [Operate](/admin-guide/gitlab/)  [Read the manual](https://docs.gitlab.com/user/) |
| SuiteCRM | Customer records, sales work, and CRM activities. | [Use](/user-guide/suitecrm/) · [Architecture](/infrastructure/suitecrm/) · [Operate](/admin-guide/suitecrm/)  [Read the manual](https://docs.suitecrm.com/user/) |
| Zammad | Support tickets and customer conversations. | [Use](/user-guide/zammad/) · [Architecture](/infrastructure/zammad/) · [Operate](/admin-guide/zammad/)  [Read the manual](https://user-docs.zammad.org/en/latest/) |
| BentoPDF | PDF tools in the browser. | [Use](/user-guide/bentopdf/) · [Architecture](/infrastructure/bentopdf/) · [Operate](/admin-guide/bentopdf/)  [Read the manual](https://www.bentopdf.com/docs/) |

## Identity, access, and protection

| Service | Purpose | Guides | Official manual |
| --- | --- | --- | --- |
| Authentik | Identity, application access, and SSO. | [Use](/user-guide/authentik/) · [Architecture](/infrastructure/authentik/) · [Operate](/admin-guide/authentik/)  [Read the manual](https://docs.goauthentik.io/) |
| Vaultwarden | Password vaults through Bitwarden-compatible clients. | [Use](/user-guide/vaultwarden/) · [Architecture](/infrastructure/vaultwarden/) · [Operate](/admin-guide/vaultwarden/)  [Read the manual](https://github.com/dani-garcia/vaultwarden/wiki) |
| Headscale and Headplane | Private device connectivity and its administration UI. | [Use](/user-guide/headscale/) · [Architecture](/infrastructure/headscale/) · [Operate](/admin-guide/headscale/)  [Read the manual](https://headscale.net/stable/) |
| RustDesk | Remote desktop rendezvous and relays. | [Use](/user-guide/rustdesk/) · [Architecture](/infrastructure/rustdesk/) · [Operate](/admin-guide/rustdesk/)  [Read the manual](https://rustdesk.com/docs/en/) |
| CrowdSec | Traffic decisions, log processing, and application protection. | [Use](/user-guide/crowdsec/) · [Architecture](/infrastructure/crowdsec/) · [Operate](/admin-guide/crowdsec/)  [Read the manual](https://docs.crowdsec.net/docs/intro/) |

## AI services

| Service | Purpose | Guides | Official manual |
| --- | --- | --- | --- |
| Open WebUI | Chat and knowledge workflows using configured models. | [Use](/user-guide/open-webui/) · [Architecture](/infrastructure/open-webui/) · [Operate](/admin-guide/open-webui/)  [Read the manual](https://docs.openwebui.com/) |
| LiteLLM | Shared model API, virtual keys, and provider discovery. | [Use](/user-guide/litellm/) · [Architecture](/infrastructure/litellm/) · [Operate](/admin-guide/litellm/)  [Read the manual](https://docs.litellm.ai/docs/) |

## Delivery, monitoring, and backup

| Service | Purpose | Guides | Official manual |
| --- | --- | --- | --- |
| Renovate | Hourly dependency-update pull requests through the antblu-renovate GitHub App. | [Use](/user-guide/renovate/) · [Architecture](/infrastructure/renovate/) · [Operate](/admin-guide/renovate/) | [Read the manual](https://docs.renovatebot.com/) |
| Argo CD | Git reconciliation and application delivery. | [Use](/user-guide/argocd/) · [Architecture](/infrastructure/argocd/) · [Operate](/admin-guide/argocd/)  [Read the manual](https://argo-cd.readthedocs.io/en/stable/user-guide/) |
| Rancher | Kubernetes administration UI. | [Use](/user-guide/rancher/) · [Architecture](/infrastructure/rancher/) · [Operate](/admin-guide/rancher/)  [Read the manual](https://ranchermanager.docs.rancher.com/) |
| Grafana, metrics, and logs | Dashboards, metrics history, and log queries. | [Use](/user-guide/victoriametrics/) · [Architecture](/infrastructure/victoriametrics/) · [Operate](/admin-guide/victoriametrics/)  [Read the manual](https://grafana.com/docs/grafana/latest/) |
| Uptime Kuma | Endpoint checks and configured status pages. | [Use](/user-guide/uptime-kuma/) · [Architecture](/infrastructure/uptime-kuma/) · [Operate](/admin-guide/uptime-kuma/)  [Read the manual](https://github.com/louislam/uptime-kuma/wiki) |
| UrBackup | Client file and image backups. | [Use](/user-guide/urbackup/) · [Architecture](/infrastructure/urbackup/) · [Operate](/admin-guide/urbackup/)  [Read the manual](https://www.urbackup.org/administration_manual.html) |
| Documentation site | This handbook and its container publishing pipeline. | [Use](/user-guide/docs/) · [Architecture](/infrastructure/docs/) · [Operate](/admin-guide/docs/)  [Read the manual](https://starlight.astro.build/) |

## Cluster foundations

| Service | Purpose | Guides | Official manual |
| --- | --- | --- | --- |
| Traefik | HTTP routing, TLS entrypoints, and middleware. | [Use](/user-guide/traefik/) · [Architecture](/infrastructure/traefik/) · [Operate](/admin-guide/traefik/)  [Read the manual](https://doc.traefik.io/traefik/) |
| MetalLB | Local LoadBalancer address allocation and advertisement. | [Use](/user-guide/metallb/) · [Architecture](/infrastructure/metallb/) · [Operate](/admin-guide/metallb/)  [Read the manual](https://metallb.io/usage/) |
| cert-manager | Certificate issuance and renewal. | [Use](/user-guide/cert-manager/) · [Architecture](/infrastructure/cert-manager/) · [Operate](/admin-guide/cert-manager/)  [Read the manual](https://cert-manager.io/docs/) |
| Sealed Secrets | Decrypt committed credentials into Kubernetes Secrets. | [Use](/user-guide/sealed-secrets/) · [Architecture](/infrastructure/sealed-secrets/) · [Operate](/admin-guide/sealed-secrets/)  [Read the manual](https://github.com/bitnami/sealed-secrets) |
| OpenEBS | Node-local persistent volumes. | [Use](/user-guide/openebs/) · [Architecture](/infrastructure/openebs/) · [Operate](/admin-guide/openebs/)  [Read the manual](https://openebs.io/docs/) |
| NFS CSI driver | Mount external NFS exports from Kubernetes. | [Use](/user-guide/nfs-driver/) · [Architecture](/infrastructure/nfs-driver/) · [Operate](/admin-guide/nfs-driver/)  [Read the manual](https://github.com/kubernetes-csi/csi-driver-nfs) |
| CloudNativePG | PostgreSQL cluster lifecycle. | [Use](/user-guide/cnpg-operator/) · [Architecture](/infrastructure/cnpg-operator/) · [Operate](/admin-guide/cnpg-operator/)  [Read the manual](https://cloudnative-pg.io/documentation/) |
| MariaDB operator | MariaDB cluster lifecycle. | [Use](/user-guide/mariadb-operator/) · [Architecture](/infrastructure/mariadb-operator/) · [Operate](/admin-guide/mariadb-operator/)  [Read the manual](https://github.com/mariadb-operator/mariadb-operator) |
| Metrics Server | Current Kubernetes resource measurements. | [Use](/user-guide/metrics-server/) · [Architecture](/infrastructure/metrics-server/) · [Operate](/admin-guide/metrics-server/)  [Read the manual](https://github.com/kubernetes-sigs/metrics-server) |

## Services outside the application tree

[Debian VMs](/infrastructure/virtual-machines/) run llama-swap and Speaches on RTX, plus Talk recording, Immich Machine Learning, Jellyfin, and Docling on Arc. These workloads follow OpenTofu and Ansible, not an Argo CD Application. The Immich server itself is managed elsewhere.

[Azure and the home proxies](/infrastructure/networking/) provide another layer outside Kubernetes. [NFS and Garage](/infrastructure/storage/) are external data dependencies; their clients in this repository do not define the storage server's lifecycle.

The `apps/homepage/` directory is empty in the current checkout and does not declare an Application. It is not listed as an active service definition. A directory name alone is not evidence that a service is deployed.
