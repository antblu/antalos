---
title: Hosts and Talos
description: "Physical topology, Talos nodes, networks, storage, and GitOps control paths for the antalos cluster."
sidebar:
  order: 1
---

antalos is a six-node Talos Linux Kubernetes cluster distributed across three Proxmox hosts. OpenTofu owns the virtual machines and Kubernetes bootstrap; Argo CD owns steady-state cluster resources and applications.

## Physical and cluster topology

<figure class="architecture-diagram" aria-label="antalo