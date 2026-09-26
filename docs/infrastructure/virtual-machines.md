---
title: Debian application VMs
description: Understand the workloads outside Kubernetes and their OpenTofu, Ansible, GPU, and storage dependencies.
---

The Debian VMs run beside the Talos cluster. OpenTofu owns their virtual hardware; Ansible owns the declared guest configuration. GPU workloads and media services in these projects do not appear as Argo CD applications.

## Current project responsibilities

| VM | Provisioning | Guest configuration | Declared responsibility |
| --- | --- | --- | --- |
| `debian-left` | `infrastructure/opentofu/lefttofu/` | `infrastructure/ansible/leftansible/` | Docker host, Caddy and media Compose projects, and shared NFS media mount; the playbook copies both projects without starting them |
| `debian-rtx` | `infrastructure/opentofu/rtxtofu/` | `infrastructure/ansible/rtxansible/` | RTX 3060 passthrough, NVIDIA runtime, llama-swap, and Speaches |
| `debian-arc` | `infrastructure/opentofu/arctofu/` | `infrastructure/ansible/arcansible/` | Intel Arc A310, Talk recording, Immich Machine Learning, Jellyfin, Trailarr, Tdarr, LazyLibrarian, Storyteller, and Docling |

The left playbook copies its Compose projects but does not start them. Older
manually installed transcription or translation containers require a separate
inventory before making claims about their current runtime state.

## RTX model and speech services

The RTX playbook copies Compose and llama-swap configuration to `/opt/compose`. Model storage is `/srv/llama-models`. Locally referenced GGUF files must be supplied separately; definitions using upstream model acquisition use that directory as their cache.

llama-swap exposes the model API on the VM's port 8080 under `/v1`. Its configuration groups the baseline embedding, reranking, and small chat models, and swaps that group for a selected larger model. Speaches runs independently on port 8000 and can consume GPU memory at the same time. The model list and scheduling policy belong to `rtxansible/compose/config.yaml`; do not duplicate its model filenames or version pins in application variables.

LiteLLM can discover the model and speech endpoints, while Open WebUI and other clients use the gateway. A replicated Kubernetes gateway does not supply a second GPU backend when this VM is unavailable.

## Arc media and document services

| Service | Integration boundary |
| --- | --- |
| Talk recording | Recorder and shared secret must agree with Nextcloud; the Arc playbook configures `recording_servers` |
| Immich Machine Learning | Remote inference endpoint for an Immich server managed elsewhere |
| Jellyfin | Media server with Intel acceleration and the shared NFS media mount |
| Trailarr / Tdarr | Trailer management and media encoding against the same NFS media tree; Tdarr scratch space is VM local |
| Storyteller | Ebook/audiobook alignment with the Intel SYCL image; application UID:GID `1008:1008`, book assets on the Jellyfin NFS export, database and scratch space local |
| LazyLibrarian | Author discovery and separate ebook/audiobook libraries; qBittorrent on Debian Left downloads to the shared NFS media tree, and Storyteller watches completed libraries |
| Docling | Document-conversion API using the declared Intel XPU image and its API key |

Both media VMs mount `10.30.0.5:/mnt/warm/jellyfin` at `/mnt/warm/jellyfin` and use UID:GID `1008:1008` for media access. Application state and transcode scratch space remain local to each VM. Debian Left owns the Arr, request, subtitle, music, and Jellyfin companion applications in a separate media Compose project. The guest needs a working Intel render device before GPU containers start. The project includes boot ordering and kernel/device preparation for that purpose. Image versions and runtime options live in the VM project itself.

## Availability and recovery

Storyteller serves HTTP on `10.30.0.28:8001`. Its book and audio assets live in
`/mnt/warm/jellyfin/storyteller`, mounted at `/media/storyteller`; its database,
processing files, and generated authentication key live under
`/opt/compose/data/storyteller`. Back up the local state and original key together
with the NFS assets. Container startup prepares permissions before dropping to
`1008:1008` through `PUID`/`PGID`, as required by the upstream image.

LazyLibrarian serves HTTP on `10.30.0.28:5299` and stores its database and protected
downloader connection under `/opt/compose/data/lazylibrarian`. Ebooks and audiobooks
are organized in `/media/books/ebooks` and `/media/books/audiobooks` in all relevant
containers. qBittorrent uses categories `books` and `audiobooks` with matching
directories under `/media/downloads`. Storyteller watches each completed library
in reference mode; matching formats from separate folders can be merged before
alignment. Acquisition depends on Debian Left's qBittorrent, configured providers,
and the shared NAS, while alignment also depends on Arc.

Each VM is a single compute endpoint. Losing the VM, its GPU, its storage, or its physical host interrupts the features it supplies. Kubernetes replicas can keep an application's other functions available while recording, conversion, or local inference remains unavailable.

Back up VM state according to the data it owns: model files that cannot be reacquired, Jellyfin configuration, media, credentials, and outputs. A successful VM recreation is not a restore of these items. See [VM lifecycle](/admin-guide/virtual-machines/) for the operating sequence.
