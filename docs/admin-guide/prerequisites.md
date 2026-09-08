---
title: "Prepare your workstation"
description: "Tools, access, and private configuration needed to deploy and administer Antalos."
---

Deploy from a workstation that can reach Proxmox, the Talos node network, and the Kubernetes API. Keep a working shell and recovery credentials available outside the services you are about to change.

## Tools and their responsibilities

| Tool | Purpose | Official reference |
| --- | --- | --- |
| Git | Obtain manifests and publish reviewed desired state | [Git documentation](https://git-scm.com/doc) |
| OpenTofu | Provision VMs and bootstrap Kubernetes/Argo CD | [OpenTofu documentation](https://opentofu.org/docs/) |
| talosctl | Configure and recover Talos machines | [Talos documentation](https://docs.siderolabs.com/talos/) |
| kubectl | Inspect and administer Kubernetes | [kubectl documentation](https://kubernetes.io/docs/reference/kubectl/) |
| kubeseal | Encrypt credentials for Git | [Sealed Secrets](https://github.com/bitnami/sealed-secrets) |
| Python 3 | Produce client configuration in the CLI guide | [Python documentation](https://docs.python.org/3/) |

Match CLI compatibility to the cluster and pinned provider versions. The optional documentation development tools are described in the [site authoring guide](/admin-guide/site-authoring/).

This repository’s workstation has kubectl at `/home/linuxbrew/.linuxbrew/bin/kubectl`. All cluster examples use that executable and `--kubeconfig kubeconfig` from the repository root. On a different workstation, substitute the installed executable while preserving the explicit kubeconfig.

## Access to arrange before bootstrap

- Proxmox API and SSH access with the permissions required by the OpenTofu provider.
- The intended Git repository and container registry, including private package access where needed.
- DNS-zone administration for certificate validation and public service records.
- The external NFS exports and Garage buckets used by your applications.
- An encrypted, off-cluster recovery location for OpenTofu state, sealing keys, database backups, and storage backups.

## Prepare a fork

Clone your repository and update Git source URLs and tracked branches in the bootstrap and Argo Application definitions. Change environment-specific values in `apps/variables.yaml`, then review the infrastructure stack’s own inputs in `infrastructure/opentofu/talostofu/variables.tf`.

VM and network provisioning inputs are owned by OpenTofu. The shared application variable file is the source of truth for Kubernetes/Helm hostnames, addresses, image tags, chart versions, node names, and requested volume sizes.

## Keep credentials local

Create the untracked `infrastructure/opentofu/talostofu/terraform.tfvars` using the variable names declared by the stack. A minimal credential portion has this shape:

```hcl title="Private terraform.tfvars · example only"
proxmox_endpoint     = "https://PROXMOX_HOST:8006/"
proxmox_api_token    = "terraform@pam!provider=REPLACE_ME"
proxmox_ssh_username = "terraform"
proxmox_ssh_password = "REPLACE_ME"
```

Choose the provider’s certificate-verification setting for your Proxmox trust configuration. This excerpt is not the complete topology configuration: also supply the intended hosts, bridges, disks, images, and node addresses required by the stack.

Do not commit `.tfvars`, OpenTofu state, kubeconfig, talosconfig, plaintext Secrets, or controller private keys. An ignored file is still sensitive; restrict file permissions and keep durable encrypted backups.

Continue with [cluster bootstrap](/admin-guide/bootstrap/).
