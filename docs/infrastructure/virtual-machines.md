---
title: Debian application VMs
description: Understand the workloads outside Kubernetes and their OpenTofu, Ansible, GPU, and storage dependencies.
---

The Debian VMs run beside the Talos cluster. OpenTofu owns their virtual hardware; Ansible owns the declared guest configuration. GPU workloads and media services in these projects do not appear as Argo CD applications.

## Current project responsibilities

| VM | Provisioning | Guest configuration | Declared responsibility |
| --- | --- | --- | --- |
| `debian-left` | `infrastructure/opentofu/lefttofu/` | `infrastructure/ansible/leftansible/` | Base Debian host, packages, Docker prerequisites, and guest agent; the playbook does not deploy Compose |
| `debian-rtx` | `infrastructure/opentofu/rtxtofu/` | `infrastructure/ansible/rtxansible/` | RTX 3060 passthrough, NVIDIA runtime, llama-swap, and Speaches |
| `debian-arc` | `infrastructure/opentofu/arctofu/` | `infrastructure/ansible/arcansible/` | Intel Arc A310, Talk recording, Immich Machine Learning, Jellyfin, and Docling |

Files remaining under a project's `compose/` directory do not prove its current playbook deploys them. In particular, the left playbook is now a base-host role. Older manually installed transcription or translation containers require a separate inventory before making claims about their current runtime state.

## RTX model and speech services

The RTX playbook copies Compose and llama-swap configuration to `/opt/compose`. Model storage is `/srv/llama-models`. Locally referenced GGUF files must be supplied separately; definitions using upstream model acquisition use that directory as their cache.

llama-swap exposes the model API on the VM's port 8080 under `/v1`. Its configuration groups the baseline embedding, reranking, and small chat models, and swaps that group for a selected larger model. Speaches runs independently on port 8000 and can consume GPU memory at the same time. The model list and scheduling policy belong to `rtxansible/compose/config.yaml`; do not duplicate its model filenames or version pins in application variables.

LiteLLM can discover the model and speech endpoints, while Open WebUI and other clients use the gateway. A replicated Kubernetes gateway does not supply a second GPU backend when this VM is unavailable.

## Arc media and document services

| Service | Integration boundary |
| --- | --- |
| Talk recording | Recorder and shared secret must agree with Nextcloud; the Arc playbook configures `recording_servers` |
| Immich Machine Learning | Remote inference endpoint for an Immich server managed elsewhere |
| Jellyfin | Media server with Intel acceleration and a separately prepared `/srv/media` directory |
| Docling | Document-conversion API using the declared Intel XPU image and its API key |

The guest needs a working Intel render device before GPU containers start. The project includes boot ordering and kernel/device preparation for that purpose. Image versions and runtime options live in the VM project itself.

## Availability and recovery

Each VM is a single compute endpoint. Losing the VM, its GPU, its storage, or its physical host interrupts the features it supplies. Kubernetes replicas can keep an application's other functions available while recording, conversion, or local inference remains unavailable.

Back up VM state according to the data it owns: model files that cannot be reacquired, Jellyfin configuration, media, credentials, and outputs. A successful VM recreation is not a restore of these items. See [VM lifecycle](/admin-guide/virtual-machines/) for the operating sequence.
