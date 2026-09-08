---
title: "Infrastructure Explanation"
description: "Understand the backend before changing it."
---

Understand the backend before changing it. Start with [platform topology](/infrastructure/platform/) and [service availability](/infrastructure/availability/), then follow an application’s request path and recovery contract.

## Applications

| Service | Purpose |
| --- | --- |
| [Authentik](/infrastructure/authentik/) | Authentik is the identity service for Antalos. |
| [BentoPDF](/infrastructure/bentopdf/) | BentoPDF provides browser-based PDF tools for merging, splitting, rotating, compressing, and converting documents. |
| [Antalos documentation](/infrastructure/docs/) | This site is the handbook for using, understanding, and operating Antalos. |
| [GitLab](/infrastructure/gitlab/) | GitLab brings Git repositories, merge requests, issue tracking, a container registry, and CI/CD project configuration into one workspace. |
| [Headscale and Headplane](/infrastructure/headscale/) | Headscale coordinates a private network of Tailscale-compatible clients. |
| [LiteLLM](/infrastructure/litellm/) | LiteLLM is the shared API gateway for language-model providers. |
| [Nextcloud](/infrastructure/nextcloud/) | Nextcloud is the collaboration workspace for files, calendars, contacts, notes, shared boards, and conversations. |
| [Open WebUI](/infrastructure/open-webui/) | Open WebUI is the browser interface for chatting with configured AI models and working with uploaded knowledge. |
| [Rancher](/infrastructure/rancher/) | Rancher provides a browser workspace for inspecting Kubernetes clusters, workloads, namespaces, and access. |
| [RustDesk](/infrastructure/rustdesk/) | RustDesk supplies remote desktop access between enrolled clients. |
| [Stalwart Mail](/infrastructure/stalwart/) | Stalwart is Antalos’s mail service. |
| [SuiteCRM](/infrastructure/suitecrm/) | SuiteCRM tracks customer relationships through leads, contacts, accounts, opportunities, activities, and cases. |
| [UrBackup](/infrastructure/urbackup/) | UrBackup manages file and image backups from supported client devices. |
| [Vaultwarden](/infrastructure/vaultwarden/) | Vaultwarden is a self-hosted server compatible with Bitwarden clients. |
| [Grafana and VictoriaMetrics](/infrastructure/victoriametrics/) | Grafana is the dashboard interface for Antalos metrics and logs. |
| [Zammad](/infrastructure/zammad/) | Zammad is a help-desk workspace for tickets, customer conversations, queues, and support history. |


## Platform services

| Service | Purpose |
| --- | --- |
| [Argo CD](/infrastructure/argocd/) | Argo CD is the delivery controller for Antalos. |
| [cert-manager](/infrastructure/cert-manager/) | cert-manager automates TLS certificate issuance and renewal. |
| [CloudNativePG](/infrastructure/cnpg-operator/) | CloudNativePG manages PostgreSQL clusters for Antalos applications. |
| [MariaDB operator](/infrastructure/mariadb-operator/) | The MariaDB operator turns database declarations into managed MariaDB servers, users, grants, and backups. |
| [MetalLB](/infrastructure/metallb/) | MetalLB assigns and advertises LoadBalancer addresses on the local network. |
| [Metrics Server](/infrastructure/metrics-server/) | Metrics Server supplies recent CPU and memory measurements to the Kubernetes resource-metrics API. |
| [NFS CSI driver](/infrastructure/nfs-driver/) | The NFS CSI driver lets Kubernetes pods mount an existing NFS server. |
| [OpenEBS](/infrastructure/openebs/) | OpenEBS provisions the node-local persistent volumes used by Antalos databases and metrics services. |
| [Sealed Secrets](/infrastructure/sealed-secrets/) | Sealed Secrets allows encrypted Kubernetes credentials to be stored in Git. |
| [Traefik](/infrastructure/traefik/) | Traefik routes external requests to Antalos services. |
