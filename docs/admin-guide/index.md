---
title: "Deployment and Admin Guide"
description: "Build and operate your own Antalos installation."
---

Build and operate your own Antalos installation. Read the shared setup once, then use the matching application guide for dependency order, credentials, identity, and the integrations that remain after deployment.

## A complete deployment path

1. Prepare [workstation tools and access](/admin-guide/prerequisites/).
2. [Bootstrap the cluster](/admin-guide/bootstrap/) or connect to an existing one with the [CLI guide](/admin-guide/cli/).
3. Restore or establish the [sealing identity](/admin-guide/secrets/).
4. Follow the [application deployment workflow](/admin-guide/deploy-an-application/).
5. Complete the application’s [SSO and integration settings](/admin-guide/single-sign-on/).
6. Establish [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/).


## Applications

| Service | Purpose |
| --- | --- |
| [Authentik](/admin-guide/authentik/) | Authentik is the identity service for Antalos. |
| [BentoPDF](/admin-guide/bentopdf/) | BentoPDF provides browser-based PDF tools for merging, splitting, rotating, compressing, and converting documents. |
| [Antalos documentation](/admin-guide/docs/) | This site is the handbook for using, understanding, and operating Antalos. |
| [GitLab](/admin-guide/gitlab/) | GitLab brings Git repositories, merge requests, issue tracking, a container registry, and CI/CD project configuration into one workspace. |
| [Headscale and Headplane](/admin-guide/headscale/) | Headscale coordinates a private network of Tailscale-compatible clients. |
| [LiteLLM](/admin-guide/litellm/) | LiteLLM is the shared API gateway for language-model providers. |
| [Nextcloud](/admin-guide/nextcloud/) | Nextcloud is the collaboration workspace for files, calendars, contacts, notes, shared boards, and conversations. |
| [Open WebUI](/admin-guide/open-webui/) | Open WebUI is the browser interface for chatting with configured AI models and working with uploaded knowledge. |
| [Rancher](/admin-guide/rancher/) | Rancher provides a browser workspace for inspecting Kubernetes clusters, workloads, namespaces, and access. |
| [RustDesk](/admin-guide/rustdesk/) | RustDesk supplies remote desktop access between enrolled clients. |
| [Stalwart Mail](/admin-guide/stalwart/) | Stalwart is Antalos’s mail service. |
| [SuiteCRM](/admin-guide/suitecrm/) | SuiteCRM tracks customer relationships through leads, contacts, accounts, opportunities, activities, and cases. |
| [UrBackup](/admin-guide/urbackup/) | UrBackup manages file and image backups from supported client devices. |
| [Vaultwarden](/admin-guide/vaultwarden/) | Vaultwarden is a self-hosted server compatible with Bitwarden clients. |
| [Grafana and VictoriaMetrics](/admin-guide/victoriametrics/) | Grafana is the dashboard interface for Antalos metrics and logs. |
| [Zammad](/admin-guide/zammad/) | Zammad is a help-desk workspace for tickets, customer conversations, queues, and support history. |


## Platform services

| Service | Purpose |
| --- | --- |
| [Argo CD](/admin-guide/argocd/) | Argo CD is the delivery controller for Antalos. |
| [cert-manager](/admin-guide/cert-manager/) | cert-manager automates TLS certificate issuance and renewal. |
| [CloudNativePG](/admin-guide/cnpg-operator/) | CloudNativePG manages PostgreSQL clusters for Antalos applications. |
| [MariaDB operator](/admin-guide/mariadb-operator/) | The MariaDB operator turns database declarations into managed MariaDB servers, users, grants, and backups. |
| [MetalLB](/admin-guide/metallb/) | MetalLB assigns and advertises LoadBalancer addresses on the local network. |
| [Metrics Server](/admin-guide/metrics-server/) | Metrics Server supplies recent CPU and memory measurements to the Kubernetes resource-metrics API. |
| [NFS CSI driver](/admin-guide/nfs-driver/) | The NFS CSI driver lets Kubernetes pods mount an existing NFS server. |
| [OpenEBS](/admin-guide/openebs/) | OpenEBS provisions the node-local persistent volumes used by Antalos databases and metrics services. |
| [Sealed Secrets](/admin-guide/sealed-secrets/) | Sealed Secrets allows encrypted Kubernetes credentials to be stored in Git. |
| [Traefik](/admin-guide/traefik/) | Traefik routes external requests to Antalos services. |


## Detailed procedures

- [Nextcloud identity and companion integrations](/admin-guide/nextcloud-integrations/)
- [Nextcloud upgrade procedure](/admin-guide/nextcloud-upgrades/)
- [Nextcloud Talk networking](/admin-guide/nextcloud-talk/)
- [RustDesk network and recovery details](/admin-guide/rustdesk-network/)
- [Build and customize this documentation](/admin-guide/site-authoring/)
