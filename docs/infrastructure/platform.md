---
title: Infrastructure architecture
description: Physical topology, Talos nodes, networks, storage, and GitOps control paths for the Antalos cluster.
sidebar:
  order: 1
---

Antalos is a six-node Talos Linux Kubernetes cluster distributed across three Proxmox hosts. OpenTofu owns the virtual machines and Kubernetes bootstrap; Argo CD owns steady-state cluster resources and applications.

## Physical and cluster topology

<figure class="architecture-diagram" aria-label="Three hosts, distinct responsibilities">
<div class="diagram-heading">Three hosts, distinct responsibilities</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Physical hosts</span><ul><li>SE350 left · control + worker</li><li>SE350 right · control + worker</li><li>RTX · control + quorum worker</li></ul></li><li class="diagram-stage"><span class="diagram-label">Kubernetes roles</span><ul><li>3 control-plane / etcd members</li><li>2 main workers / application data</li><li>RTX voters + Gitaly repository copy</li></ul></li><li class="diagram-stage"><span class="diagram-label">Persistence</span><ul><li>Node-local OpenEBS volumes</li><li>External NFS / Garage</li><li>Git + external recovery material</li></ul></li></ol>
<figcaption>Each host carries one control-plane VM and one worker. Application replication protects separate local volumes; shared external storage and the configured API address remain distinct failure boundaries.</figcaption>
</figure>

Each Proxmox host carries one control-plane VM and one worker VM. This spreads the Kubernetes control plane and the primary worker failure domains across `se350-left`, `se350-right`, and `rtx`.

| Node | Address | Proxmox host | Capacity and role |
| --- | --- | --- | --- |
| `talos-control-left` | `10.30.0.7` | `se350-left` | 2 vCPU, 4 GiB RAM, 32 GB disk; control plane and etcd |
| `talos-control-right` | `10.30.0.8` | `se350-right` | 2 vCPU, 4 GiB RAM, 32 GB disk; control plane and etcd |
| `talos-control-rtx` | `10.30.0.6` | `rtx` | 2 vCPU, 4 GiB RAM, 32 GB disk; control plane, etcd, and bootstrap endpoint |
| `talos-worker-left` | `10.30.0.17` | `se350-left` | 10 vCPU, 28 GiB RAM, 300 GB disk; primary workload and local storage node |
| `talos-worker-right` | `10.30.0.18` | `se350-right` | 10 vCPU, 28 GiB RAM, 300 GB disk; primary workload and local storage node |
| `talos-worker-rtx` | `10.30.0.16` | `rtx` | 2 vCPU, 4 GiB RAM, 20 GB disk; tainted `quorum:NoSchedule` for lightweight voters |
| `debian-arc` | `10.30.0.28` | `se350-right` | 4 vCPU, 8 GiB RAM, 300 GB disk; AppAPI, Talk recording, Immich ML, and Jellyfin |

The three control-plane nodes form an etcd quorum and can tolerate one control-plane member failure. The configured Kubernetes API endpoint is currently the address of `talos-control-rtx`, not a virtual IP or external load balancer. The control plane therefore has replicated members, but the client endpoint itself remains a single ingress path until a control-plane VIP or load balancer is added.

## Worker placement model

The two SE350 workers carry normal application workloads and replicated data members. Required pod anti-affinity places paired replicas on different Kubernetes hosts. Stateful services such as CloudNativePG, Redis, Elasticsearch, and MariaDB replicate at the application layer between these two workers.

The RTX worker is deliberately tainted. Only workloads with the matching toleration schedule there. It supplies a third failure domain for small quorum components, including Redis Sentinel voters, the SuiteCRM Galera arbitrator, and the three-member NATS layout used by Nextcloud Talk. GitLab also places a full Gitaly repository member on RTX for its three-member repository topology; it is not merely a vote. The small RTX worker is not a general replacement for the capacity of either main worker, and that data workload must be included when assessing headroom.

## Networking

| Network or address | Purpose |
| --- | --- |
| `10.30.0.0/24` | Internal Talos and Kubernetes node network |
| `10.244.0.0/16` | Kubernetes pod network |
| `10.30.0.200-10.30.0.250` | MetalLB address pool |
| `10.30.0.200` | Shared ingress and mail `LoadBalancer` address |
| `10.30.0.241` | Nextcloud Talk TURN `LoadBalancer` address |

Control-plane VMs have an internal interface. Workers have internal and external interfaces, with the internal route preferred. MetalLB advertises service addresses on the local network. Traefik terminates HTTPS and routes hostname-based traffic to services. cert-manager obtains certificates from the `letsencrypt-prod` cluster issuer.

The MetalLB speaker runs on cluster nodes, so L2 advertisement can move when a speaker or node fails. Traefik has two anti-affined replicas behind the shared ingress address. DNS, the upstream router, and the local network remain outside this repository's availability controls.

## Storage and state

Antalos uses multiple storage tiers because they have different availability and recovery characteristics.

| Tier | Consumers | Availability behavior |
| --- | --- | --- |
| OpenEBS LocalPV hostpath | PostgreSQL, Redis, Elasticsearch, VictoriaMetrics, MariaDB, and Gitaly | A volume is local to one worker and is not replicated by OpenEBS. Availability comes from the database or application maintaining another copy on the other worker. |
| NFS at `10.30.0.5` | Authentik media, Nextcloud apps, SuiteCRM data, Vaultwarden data, and Litestream backups | RWX data is mountable by either worker, but the repository declares one NFS endpoint. Its server, export, and underlying disk must be protected separately. |
| Garage S3 at `10.30.0.5:30188` | Nextcloud objects, Stalwart blobs, Open WebUI objects, Zammad objects, and SuiteCRM media/database backups | Applications can restart on another worker without moving object data. Garage's own replication and the host's availability are external to this repository. |
| Git | Manifests, configuration, versions, and encrypted secrets | Reconstructs desired state, but not application data or Sealed Secrets private keys. |

OpenEBS is configured only as a local-volume provisioner; the replicated Mayastor engine is disabled. A lost worker therefore takes its local volumes with it. Two-member data services can use their surviving application-level replica when promotion, client routing, and dependencies work; this may involve an interruption. Replacing the lost member requires creating or recovering storage and resynchronizing its data. Sharded services such as VictoriaLogs do not have a complete surviving copy merely because a second storage process remains.

## GitOps and secrets

OpenTofu creates the Talos VMs, applies machine configuration, bootstraps etcd, writes `kubeconfig`, and installs the initial Argo CD release. Argo CD then reconciles the root app-of-apps and the service `app.yaml` definitions discovered beneath `apps/`. An empty directory does not deploy a service.

`apps/variables.yaml` is the shared source of hostnames, addresses, node names, chart versions, image tags, and provisioned volume sizes. The `yaml-envsubst` config-management plugin expands those variables before Kubernetes manifests or Helm parameters are applied.

Application credentials are committed only as `SealedSecret` ciphertext. The controller's private key is restored during bootstrap and must be backed up outside the cluster. Existing Kubernetes Secrets continue to serve workloads if the controller is unavailable, but new or changed SealedSecrets cannot be decrypted until it returns.

## Availability boundary

The intended primary failure unit is one Kubernetes or Proxmox node. Replicas, anti-affinity, disruption budgets, database promotion, and quorum voters protect many services from that event. They do not protect against every shared dependency.

The main shared failure domains are:

- the single configured Kubernetes API address at `10.30.0.6`;
- the external NFS and Garage endpoints at `10.30.0.5`;
- local-only persistent volumes on the two main workers;
- the upstream router, DNS, Proxmox storage, and physical network;
- intentionally single-instance workloads listed in [Service availability](/infrastructure/availability/).
- the `debian-arc` VM and its Arc A310 workloads on `se350-right`.

High availability keeps a service running through an expected failure. Backups and GitOps make a service recoverable after availability mechanisms are exhausted; they are complementary, not interchangeable.

## Source of this topology

The machine layout comes from [`talostofu`](https://github.com/antblu/antalos/tree/main/infrastructure/opentofu/talostofu). Shared application values are in [`apps/variables.yaml`](https://github.com/antblu/antalos/blob/main/apps/variables.yaml). These are repository defaults and intended placement, not a live capacity or health measurement.

## Follow the complete availability contract

Use [service availability](/infrastructure/availability/) for explicit HA, partial-HA, and recovery-based classifications. It separates worker loss from physical-host/API loss, describes election and returned-member behavior, and identifies single processes, shared storage, sharded data, and rollout constraints. Each application has its own detailed component/failure table.
