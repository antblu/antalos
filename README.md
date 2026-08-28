# Antalos

> Declarative infrastructure and GitOps source of truth for my Talos Kubernetes homelab.

[![Proxmox VE](https://img.shields.io/badge/Proxmox%20VE-E57000?logo=proxmox&logoColor=white)](https://github.com/proxmox)  [![Talos Linux](https://img.shields.io/badge/Talos%20Linux-FF7300?logo=linux&logoColor=white)](https://github.com/siderolabs/talos)[![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?logo=kubernetes&logoColor=white)](https://github.com/kubernetes/kubernetes) ![IaC](https://img.shields.io/badge/IaC-OpenTofu-FFDA18?logo=opentofu&logoColor=black)![GitOps](https://img.shields.io/badge/GitOps-Argo%20CD-F05032?logo=argo&logoColor=white) [![Traefik](https://img.shields.io/badge/Traefik-24A1C1?logo=traefikproxy&logoColor=white)](https://github.com/traefik/traefik) [![cert-manager](https://img.shields.io/badge/cert--manager-326CE5?logo=kubernetes&logoColor=white)](https://github.com/cert-manager/cert-manager) [![Sealed Secrets](https://img.shields.io/badge/Sealed%20Secrets-326CE5?logo=kubernetes&logoColor=white)](https://github.com/bitnami-labs/sealed-secrets) [![Kubernetes LoadBalancer](https://img.shields.io/badge/LoadBalancer-MetalLB-326CE5?logo=kubernetes&logoColor=white)](https://github.com/metallb/metallb)[![OpenEBS](https://img.shields.io/badge/OpenEBS-5C2D91?logo=kubernetes&logoColor=white)](https://github.com/openebs/openebs) [![CloudNativePG](https://img.shields.io/badge/CloudNativePG-336791?logo=postgresql&logoColor=white)](https://github.com/cloudnative-pg/cloudnative-pg) [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql\&logoColor=white)](https://github.com/postgres/postgres) [![Redis](https://img.shields.io/badge/Redis-FF4438?logo=redis&logoColor=white)](https://github.com/redis/redis) [![Redis Sentinel](https://img.shields.io/badge/Redis-Sentinel-FF4438?logo=redis&logoColor=white)](https://github.com/redis/redis) [![Elasticsearch](https://img.shields.io/badge/Elasticsearch-005571?logo=elasticsearch&logoColor=white)](https://github.com/elastic/elasticsearch) [![Rancher](https://img.shields.io/badge/Rancher-0075A8?logo=rancher&logoColor=white)](https://github.com/rancher/rancher)[![VictoriaMetrics](https://img.shields.io/badge/VictoriaMetrics-621773?logo=prometheus&logoColor=white)](https://github.com/VictoriaMetrics/VictoriaMetrics)[![Grafana](https://img.shields.io/badge/Grafana-F46800?logo=grafana&logoColor=white)](https://github.com/grafana/grafana) [![Authentik](https://img.shields.io/badge/Authentik-FD4B2D?logo=authentik&logoColor=white)](https://github.com/goauthentik/authentik)[![Stalwart](https://img.shields.io/badge/Stalwart-Mail-005FF9?logo=maildotru&logoColor=white)](https://github.com/stalwartlabs/stalwart) [![Repo Size](https://img.shields.io/github/repo-size/antblu/antalos?logo=github)](https://github.com/antblu/antalos) [![Last Commit](https://img.shields.io/github/last-commit/antblu/antalos?logo=github)](https://github.com/antblu/antalos/commits/main) [![Open Issues](https://img.shields.io/github/issues/antblu/antalos?logo=github)](https://github.com/antblu/antalos/issues)[![GitHub Stars](https://img.shields.io/github/stars/antblu/antalos?logo=github)](https://github.com/antblu/antalos/stargazers)  

**Antalos** is the source of truth for my homelab Kubernetes infrastructure and applications.

The cluster runs **Talos Linux** on **Proxmox VE**, with the underlying virtual machines and Kubernetes bootstrap managed through **OpenTofu**. After the initial bootstrap, **Argo CD** continuously reconciles the cluster from this repository.

The goal is to keep as much of the environment as possible **declarative, reproducible, and recoverable from Git**.

---

## Architecture

```mermaid
flowchart TD
    Git["GitHub<br/>antblu/antalos"]

    Tofu["OpenTofu"]
    Proxmox["Proxmox VE"]
    Talos["Talos Linux"]
    K8s["Kubernetes"]

    Argo["Argo CD"]
    Apps["Cluster Applications"]

    Git --> Tofu
    Tofu --> Proxmox
    Proxmox --> Talos
    Talos --> K8s

    Git --> Argo
    Argo --> Apps
    Apps --> K8s
```

The repository is divided into two main responsibilities:

1. **Infrastructure bootstrap** — OpenTofu creates the Talos VMs, bootstraps Kubernetes, and installs the initial Argo CD deployment.
    
2. **GitOps reconciliation** — Argo CD takes over steady-state management and continuously reconciles Kubernetes resources from Git.
    

---

## Stack as of 8/28/26

|Layer|Technology|Purpose|
|---|---|---|
|Hypervisor|**Proxmox VE**|Hosts the cluster virtual machines|
|Operating System|**Talos Linux**|Immutable Kubernetes-focused OS|
|Infrastructure as Code|**OpenTofu**|Provisions VMs and bootstraps the cluster|
|Container Orchestration|**Kubernetes**|Runs cluster workloads|
|GitOps|**Argo CD**|Reconciles cluster state from Git|
|Ingress|**Traefik**|HTTP/HTTPS ingress|
|Load Balancing|**MetalLB**|Bare-metal `LoadBalancer` services|
|Certificates|**cert-manager**|Automated TLS certificate management|
|Secrets|**Sealed Secrets**|Encrypted secrets stored safely in Git|
|Storage|**OpenEBS**|Local persistent storage|
|PostgreSQL|**CloudNativePG**|PostgreSQL lifecycle and replication|
|Authentication|**Authentik**|Identity provider and SSO|
|Management|**Rancher**|Kubernetes management interface|
|Monitoring|**VictoriaMetrics**|Metrics and observability|
|Mail|**Stalwart**|Mail services|

---

## Repository Structure

```text
antalos/
├── apps/
│   ├── <app-name>/
│   └── variables.yaml
│
├── docs/
│
├── infrastructure/
│   ├── argocd/
│   │   ├── app-of-apps.yaml
│   │   ├── argocd-self.yaml
│   │   └── default-project.yaml
│   │
│   ├── cert-manager/
│   ├── metallb/
│   │
│   └── opentofu/
│       ├── argotofu/
│       └── talostofu/
│
├── kubeconfig/
├── talosconfig/
|
├── LICENSE
└── README.md
```

### `apps/`

Contains the applications and Kubernetes resources managed by Argo CD.

Argo CD watches this part of the repository and reconciles the desired state into the cluster.

Shared externally managed values such as hostnames, load balancer addresses, and Talos node names are centralized in:

```text
apps/variables.yaml
```

These values are substituted into application manifests during rendering.

### `infrastructure/opentofu/talostofu/`

Creates the Talos virtual machines and bootstraps the Kubernetes cluster.

This layer handles infrastructure such as:

- Proxmox virtual machines
- Talos machine configuration
- control-plane nodes
- worker nodes
- node names and addressing
- Talos volumes
- Kubernetes bootstrap
- kubeconfig generation

### `infrastructure/opentofu/argotofu/`

Bootstraps Argo CD after Kubernetes is available.

OpenTofu performs only the initial installation needed to establish GitOps. Argo CD then manages its own steady-state configuration from Git.

### `infrastructure/argocd/`

Contains the root GitOps resources:

```text
argocd-self.yaml
app-of-apps.yaml
default-project.yaml
```

`argocd-self` acts as the recovery anchor for the cluster and allows Argo CD to reconcile its own configuration.

---

## GitOps Model

The cluster follows an **App of Apps** model.

```mermaid
flowchart LR
    Repo["Git Repository"]
    Root["Argo CD<br/>App of Apps"]
    Apps["Application Definitions"]
    Helm["Helm Charts / Manifests"]
    Cluster["Kubernetes Cluster"]

    Repo --> Root
    Root --> Apps
    Apps --> Helm
    Helm --> Cluster
```

Once the cluster is bootstrapped, normal changes are made through Git rather than by manually modifying Kubernetes resources.

Typical workflow:

```bash
git add .
git commit -m "Update cluster configuration"
git push
```

Argo CD detects the desired-state change and synchronizes the cluster.

---
## Fresh Cluster Bootstrap

### Check out [`deployment-order.md`](https://chatgpt.com/c/docs/deployment-guide/deployment-order.md)

---
## Secrets

Plaintext credentials are **not intended to be stored in this repository**.

Secrets are encrypted with **Bitnami Sealed Secrets**:

```text
Plaintext Secret
      │
      │ kubeseal
      ▼
SealedSecret
      │
      │ commit
      ▼
     Git
      │
      ▼
   Argo CD
      │
      ▼
Sealed Secrets Controller
      │
      ▼
Kubernetes Secret
```

The Sealed Secrets private key is backed up separately and restored during cluster recovery.

This allows the Kubernetes environment to be recreated from Git while still preserving access to encrypted application credentials.

See the full procedure:

[`k8s-secrets-bootstrap.md`](https://chatgpt.com/c/docs/deployment-guide/k8s-secrets-bootstrap.md)

---
## Applications

### Platform

**Argo CD**  
Provides GitOps reconciliation and manages the desired state of the cluster.

**Traefik**  
Provides ingress routing for HTTP and HTTPS workloads.

**MetalLB**  
Provides `LoadBalancer` addresses to services on the local network.

**cert-manager**  
Automates TLS certificate issuance and renewal.

**Sealed Secrets**  
Allows encrypted Kubernetes secrets to be safely committed to Git.

**OpenEBS**  
Provides persistent local storage to Kubernetes workloads.

### Services

**Authentik**  
Identity provider and authentication platform.

**CloudNativePG**  
Operates PostgreSQL clusters, including the database used by Authentik.

**Rancher**  
Provides a web-based Kubernetes management interface.

**Stalwart**  
Provides mail services.

**VictoriaMetrics**  
Provides monitoring and metrics storage.

---

## Using This Repository

This repository documents and manages **my specific homelab environment**. It is not intended to be a turnkey Kubernetes distribution.

If you use it as a reference or fork it for your own environment, expect to change at least:

- `apps/variables.yaml`
    
- `infrastructure/opentofu/talostofu/variables.tf`
    
- `infrastructure/certmanager/certificates.yaml`
- `infrastructure/certmanager/issuer.yaml`
    
- Replace all mentions of `https://github.com/antblu/antalos.git` with your own repo
	
- Make `infrastructure/opentofu/talostofu/terraform.tfvars` file with the following format
```yaml
proxmox_endpoint  = "https://10.20.0.6:8006/"
proxmox_api_token = "terraform@pam!provider=<api-token"
proxmox_insecure  = true
proxmox_ssh_username = "terraform"
proxmox_ssh_password = "<account-password"
```
>Ensure that the terraform account in Proxmox is pam, not pve. SSH access is required. Make sure API token privileges are permissive.
---

The architecture and GitOps patterns, however, are designed to be reusable.

---
### Trademarks

All product names, logos, and brands are property of their respective owners.
Use of these names and logos does not imply endorsement.
---
## License

This project is licensed under the [MIT License](https://chatgpt.com/c/LICENSE).