---
title: Deploy and maintain Debian VMs
description: Provision the right VM, run its matching Ansible project, and connect the workload to Kubernetes consumers.
---

Start with [Debian application VMs](/infrastructure/virtual-machines/) to choose the project. These workloads use VM-specific settings and credentials; `apps/variables.yaml` configures their Kubernetes consumers only.

## 1. Prepare the VM project

Read the selected OpenTofu project's `variables.tf` and `terraform.tfvars.example`. Supply your Proxmox access, VM identity, network, storage, and hardware mapping. Preserve an existing installation's state before planning changes.

For RTX and Arc, confirm the intended PCI mapping in Proxmox before provisioning. A GPU passed through to a guest cannot be assumed available to another workload on the host. Review changes to the VM's hardware and disks as infrastructure changes.

```bash title="Example: plan the RTX VM from the repository root"
tofu -chdir=infrastructure/opentofu/rtxtofu init
tofu -chdir=infrastructure/opentofu/rtxtofu plan
```

Apply the reviewed plan when ready. Use `arctofu` for Arc or `lefttofu` for the base Debian left VM. Complete cloud-init before running guest configuration. Reboot, storage, VM recreation, and disruptive network changes require the approval described in the repository instructions.

## 2. Prepare the matching Ansible project

| VM | Read first | Inputs to prepare |
| --- | --- | --- |
| Left | `infrastructure/ansible/leftansible/README.md` | Inventory and base-host settings |
| RTX | `infrastructure/ansible/rtxansible/README.md` | Inventory, VM variables, encrypted vault, Compose model definitions, required local models |
| Arc | `infrastructure/ansible/arcansible/README.md` | Inventory, encrypted vault, media storage, and access to the Nextcloud Talk Secret |

For a new RTX or Arc vault, copy its `vars/vault.yml.example`, encrypt the new `vars/vault.yml`, and edit it with `ansible-vault edit`. For an existing vault, edit it without replacing its contents from the example. Keep original integration secrets when reconnecting existing applications.

## 3. Configure the guest

The working directory selects the project's Ansible configuration and inventory:

```bash title="Deploy the RTX guest configuration"
cd infrastructure/ansible/rtxansible
ansible-playbook site.yml --ask-vault-pass
```

Arc uses the same command from `arcansible/`. Left runs `ansible-playbook site.yml` from `leftansible/` and configures the base host only.

Read the playbook before a maintenance run. These playbooks can install packages, change kernels, restart containers, run their own checks, and in some cases reboot. Arc also reads the Kubernetes Talk Secret and writes Nextcloud recording configuration. A run is more than copying a Compose file.

## 4. Connect the consumer

| Backend | Complete the integration |
| --- | --- |
| llama-swap / Speaches | Match endpoints and credentials in [LiteLLM](/admin-guide/litellm/), then select a discovered model in the consuming application |
| Talk recording | Keep the recorder secret and Talk internal secret aligned; use [Nextcloud integrations](/admin-guide/nextcloud-integrations/) |
| Immich Machine Learning | Register the remote endpoint in the separately managed Immich server |
| Jellyfin | Prepare the intended media mount and configure libraries and access |
| Docling | Configure the client endpoint and its `X-Api-Key` credential |

Successful container startup does not finish an application integration. Use a small representative request through the actual consumer after deployment.

## Inspect without changing the VM

Use SSH aliases from the workstation configuration:

```bash title="Inspect declared VM workloads"
ssh debian-rtx 'cd /opt/compose && docker compose ps'
ssh debian-arc 'cd /opt/compose && docker compose ps'
```

Use `ssh proxmox` for hypervisor diagnostics and `ssh nas` for storage diagnostics. Do not replace configured aliases with copied IP addresses. For the left VM, use the alias established in your own SSH configuration before issuing guest commands.

## Keep the source and guest aligned

Make durable Compose changes in the Ansible project, then deploy through that project. Changes made only in `/opt/compose` can be overwritten on the next playbook run. Cloud-init changes are provisioning changes and do not automatically rerun on an existing guest.

Recover persistent data and original secrets before reconnecting consumers. A newly reachable endpoint with an empty data directory is not evidence that the former service has been restored.
