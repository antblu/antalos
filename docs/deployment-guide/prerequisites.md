---
title: Workstation prerequisites
description: Prepare the command-line tools, credentials, and local files required to administer and rebuild Antalos.
sidebar:
  order: 1
---

Prepare the administration workstation before provisioning infrastructure or bootstrapping the cluster.

## Required tools

Install these command-line tools and confirm that each command is available:

| Tool | Used for | Check |
| --- | --- | --- |
| Git | Repository changes and GitOps delivery | `git --version` |
| OpenTofu | Proxmox and cluster bootstrap stacks | `tofu version` |
| Talos CLI | Talos node lifecycle and diagnostics | `talosctl version --client` |
| kubectl | Kubernetes administration | `kubectl version --client` |
| kubeseal | Encrypting Kubernetes secrets | `kubeseal --version` |
| jq | Reading OpenTofu state and JSON output | `jq --version` |

This repository’s Kubernetes CLI is installed at `/home/linuxbrew/.linuxbrew/bin/kubectl`. Run cluster commands from the repository root with the checked-out `kubeconfig`:

```bash
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig get nodes
```

## Required access

Before a rebuild, verify access to:

- The Proxmox API and SSH account used by OpenTofu.
- The GitHub repository and its GitHub Container Registry packages.
- The DNS provider account used by cert-manager’s ACME DNS challenge.
- The NFS and Garage S3 hosts that hold application data.
- The encrypted backup containing the Sealed Secrets controller keys.

Do not store plaintext credentials, API tokens, kubeconfigs, Talos credentials, OpenTofu state, or Sealed Secrets private keys in Git.

## Local configuration files

Create the untracked OpenTofu variable file at `infrastructure/opentofu/talostofu/terraform.tfvars`:

```hcl
proxmox_endpoint     = "https://PROXMOX_HOST:8006/"
proxmox_api_token    = "terraform@pam!provider=REPLACE_ME"
proxmox_insecure     = true
proxmox_ssh_username = "terraform"
proxmox_ssh_password = "REPLACE_ME"
```

The Proxmox account uses the `pam` realm and needs both API permissions and SSH access. Keep the file local; `.gitignore` excludes `*.tfvars`.

After the Talos stack is applied, generate or retrieve:

- `talosconfig` for Talos API access.
- `kubeconfig` for Kubernetes API access.

Both files belong in the repository root for the documented commands, but remain untracked.

## Preflight checks

Run these checks before making infrastructure changes:

```bash
git status --short
tofu -chdir=infrastructure/opentofu/talostofu fmt -check
tofu -chdir=infrastructure/opentofu/talostofu validate
talosctl --talosconfig talosconfig config info
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig cluster-info
```

If the cluster does not exist yet, the final two checks are expected to fail. Continue with the [deployment order](./deployment-order/).
