---
title: Service availability
description: Replica layouts, failover mechanisms, persistent dependencies, and known single points of failure for every Antalos service.
sidebar:
  order: 2
---

This page describes the availability expressed by the repository manifests. It documents intended behavior; it is not a statement that a failover test has recently succeeded.

## Reading the status

| Status | Meaning |
| --- | --- |
| HA | The serving path has replicas in separate node failure domains and a mechanism for selecting or routing to a healthy member. |
| Partial | Important serving components are replicated, but a subsystem, update mode, or shared dependency can still interrupt the service. |
| Recovery-based | The primary workload is single-instance. Kubernetes can restart it, and data may be restorable, but failover is not continuous. |

Pod disruption budgets protect only voluntary Kubernetes evictions. They do not keep a service online after hardware failure, storage loss, a broken rollout, or loss of an external dependency.

## Platform services

| Service | Status | How availability is provided | Remaining boundary |
| --- | --- | --- | --- |
| Kubernetes control plane | Partial | Three Talos control-plane and etcd members are spread across three Proxmox hosts; etcd can retain quorum after one member fails. | The configured API endpoint is the single address `10.30.0.6`; there is no repository-managed VIP or API load balancer. |
| Argo CD | HA | Two API servers, two application controllers, two repo servers, and three Redis HA members use hard pod anti-affinity; Redis Sentinel provides quorum. | GitHub and the Kubernetes API are external dependencies. Reconciliation can pause without immediately stopping already-running workloads. |
| Traefik | HA | Two anti-affined replicas, a rolling strategy with one replica retained, a disruption budget, and a MetalLB `LoadBalancer` service. | The MetalLB address, upstream router, DNS, and network are shared paths. |
| MetalLB | Partial | Node-level speakers can continue advertising L2 addresses when another speaker or node is lost. | The controller is not explicitly replicated; allocation or configuration changes can pause while it is unavailable. |
| cert-manager | Partial | The admission webhook has two anti-affined replicas. Issued TLS Secrets continue to be used by Traefik. | The main controller and CA injector are not explicitly replicated; issuance and renewal can pause. The DNS provider and ACME service are external. |
| Sealed Secrets | Recovery-based | Existing decrypted Secrets remain in Kubernetes, and the controller key is restored from an external backup during recovery. | The controller is single-instance. New or updated ciphertext cannot be decrypted while it is down, and loss of the private-key backup is unrecoverable. |
| CloudNativePG operator | Recovery-based | Database clusters continue PostgreSQL replication and serving without continuous operator involvement. | The operator is not explicitly replicated; promotion, repair, and reconciliation may pause until it returns. |
| MariaDB operator | HA | Two operator replicas and two webhook replicas are anti-affined and protected by disruption budgets. | Managed MariaDB availability still depends on each database topology and its storage. |
| NFS CSI driver | Partial | Node plugins make the external NFS exports mountable from multiple workers and the control component is recreated by Kubernetes. | The NFS server is a single declared endpoint at `10.30.0.5`; backend HA is not defined here. |
| OpenEBS | Partial | The LocalPV provisioner is deployed on nodes and can provision host-local storage. Stateful applications place separate replicated members on different workers. | Mayastor replication is disabled. Each individual volume remains tied to one node. |
| Metrics Server | Recovery-based | Kubernetes can restart the collector and restore the aggregated metrics API. | The manifest does not explicitly increase chart replicas; resource metrics and autoscaling inputs can pause. |

## User-facing services

| Service | Status | How availability is provided | State and limitations |
| --- | --- | --- | --- |
| Authentik | Partial | Two server pods and two worker pods use hard anti-affinity. A two-instance CloudNativePG cluster can promote the surviving database member. | Shared media is on the external NFS endpoint. No Authentik disruption budget is declared in this repository. |
| Documentation site | HA | Two stateless NGINX replicas use required anti-affinity, a rollout requesting one surge pod and zero unavailable replicas, readiness probes, and a `minAvailable: 1` disruption budget. | Availability still depends on Traefik, MetalLB, and DNS. The surge pod needs a spare eligible node under hard anti-affinity; the two-worker layout can block that rollout. The mutable `main` tag also needs an explicit rollout or immutable tag update. |
| Rancher | HA | Two Rancher replicas use required anti-affinity and are routed through Traefik. | Rancher manages this same cluster, so a cluster-wide control-plane or ingress failure also removes its management interface. |
| Headscale and Headplane | Recovery-based | Kubernetes restarts one Headscale StatefulSet and one Headplane Deployment. Litestream continuously copies both SQLite databases to an NFS-backed volume and restores them into disposable local storage at startup. | Neither application has a hot replica. Recovery depends on the Litestream backup and the single NFS endpoint; restart entails an outage. |
| Vaultwarden | Recovery-based | The PostgreSQL database has two anti-affined CloudNativePG instances with preferred synchronous durability. | The Vaultwarden application has one `Recreate` replica and its `/data` directory is on the external NFS endpoint. Database redundancy does not make the complete service HA. |
| Open WebUI | Partial | Two application replicas are pinned across the main workers and protected by a disruption budget. PostgreSQL has two anti-affined instances. Redis uses two persistent data members and three Sentinel voters, with the third voter on the RTX worker. | The application uses a `Recreate` strategy, so upgrades can interrupt both replicas. S3 state depends on Garage at `10.30.0.5`. |
| LiteLLM | HA | Two anti-affined proxy replicas use rolling updates and a disruption budget. Two CloudNativePG instances provide PostgreSQL failover. Two Redis data members and three authenticated Sentinel voters span the main workers and RTX; clients discover the primary directly through Sentinel. | Failover briefly interrupts requests, and in-flight streams are not transferred. Redis replication is asynchronous; PostgreSQL permits writes without a standby. No off-cluster database backup is configured. See the [LiteLLM runbook](/admin-guide/litellm/). |
| SuiteCRM | Partial | Two anti-affined application replicas share NFS state. Two Galera data members run on the main workers, with a lightweight `garbd` voter on RTX to provide a three-vote quorum. Daily physical database backups target Garage S3. | Shared application data and backups depend on the external storage host. The minute scheduler is a single CronJob execution and the messenger worker has one replica. A two-data-node Galera layout has reduced redundancy while either data member is absent. |
| Stalwart Mail | Partial | Two Stalwart replicas run on separate main workers. PostgreSQL has two instances. Redis uses two persistent data members plus a third Sentinel voter, while Elasticsearch uses two data/master members plus a master-only voter on RTX. | Mail blobs use Garage S3. The Redis HAProxy endpoint is colocated with the single RTX quorum pod, so its loss can interrupt the configured Redis access path even while Redis data survives. |
| Zammad | Partial | NGINX and Rails each have two anti-affined replicas. PostgreSQL has two instances; Redis uses two data members and three Sentinel voters; Elasticsearch uses two data/master members and an RTX master-only voter. Object data is stored in Garage S3. | Scheduler and WebSocket each have one replica. External object storage and the shared ingress path remain dependencies. |
| BentoPDF | HA serving tier | Two anti-affined stateless replicas serve frontend assets with a disruption budget. | Browser processing runs on the client; new site access also depends on Authentik and its host-specific outpost route. |
| GitLab | Partial | Paired application roles, two CNPG pairs, three Praefect/Gitaly members, and Redis Sentinel provide replicated serving and repository paths. | RTX holds a full Gitaly data copy; Garage is external, Gitaly Cluster on Kubernetes is upstream beta, and the shared bucket is unsuitable for the stock Helm restore workflow. |
| RustDesk | Recovery-based with paired relays | One hbbs process restores SQLite from NFS; two independently addressed hbbr processes handle native relay choices. | Rendezvous restarts interrupt access, relay sessions reconnect, and WSS follows the first relay path. NFS and the original server key are recovery dependencies. |
| UrBackup | Recovery-based | A single server is restarted with retained NFS configuration and backup exports. | Native client transport needs separate publication. The single-replica disruption budget can block maintenance but does not provide a hot server. |

## Nextcloud service group

Nextcloud is a collection of independently scaled services rather than one deployment.

| Component | Status | Availability design and boundary |
| --- | --- | --- |
| Nextcloud web and `notify_push` | HA | Two anti-affined application pods, a rolling strategy, and a disruption budget keep one web/sidecar pair available. User objects live in Garage S3 and app code is shared from NFS; overall service availability still depends on both external paths. |
| PostgreSQL | HA | Two anti-affined CloudNativePG instances store Nextcloud and Context Chat metadata; the operator exposes a stable read/write service and promotes a surviving member. |
| Redis | HA | Two persistent data members run on the main workers, three Sentinel voters span all workers, and two anti-affined HAProxy replicas route clients to the current primary. |
| Context Chat | HA | Request, update, and indexing roles each have two anti-affined replicas and a `minAvailable: 1` disruption budget. They share the replicated PostgreSQL cluster and use disposable pod-local working directories. |
| EuroOffice | HA | Two anti-affined document-server replicas sit behind a sticky-cookie service. In-flight editing sessions may reconnect after a pod failure. |
| Whiteboard | Partial | Two anti-affined replicas store live collaboration state in Redis. Recording files use the shared Nextcloud NFS volume. |
| Talk signaling, Janus, and TURN | HA with session limits | Two anti-affined Talk pods use a three-member NATS cluster. Each TURN port is pinned to one StatefulSet pod so stateful allocations return to their owner. Failure of that owner interrupts its active TURN sessions rather than transparently moving them. |
| Talk recording | External | Recording is hosted outside Kubernetes. This repository supplies neither a recorder workload nor its registration; availability, spool storage, and recovery are managed on the external server. |

See [Nextcloud storage architecture](/infrastructure/nextcloud/) and [Talk backend](/admin-guide/nextcloud-talk/) for the data and network paths.

## Observability

| Service | Status | How availability is provided | Remaining boundary |
| --- | --- | --- | --- |
| VictoriaMetrics metrics | HA | `vmagent`, `vminsert`, `vmselect`, and `vmstorage` each have two anti-affined replicas. Both agents scrape targets, duplicate samples are deduplicated, and the storage replication factor is two. | Both storage copies live on local volumes on the two main workers. Loss of both workers loses the online metrics data. |
| VictoriaLogs | Partial | Insert, select, and storage roles each have two anti-affined replicas. | The manifest does not declare a VictoriaLogs replication factor, so two storage pods provide scale and process redundancy but should not be treated as two guaranteed copies of every log. |
| Grafana | HA | Two anti-affined stateless Grafana replicas share a two-instance CloudNativePG database and have a disruption budget. Provisioned dashboards come from Git. | The VictoriaMetrics operator itself has one replica, and loss of both local PostgreSQL volumes requires database recovery. |
| Collection agents | Partial | Node Exporter and log collectors run close to their targets; duplicate `vmagent` replicas protect centralized metrics scraping. | Data generated during loss of a node-local collector cannot always be reconstructed. |

## Failure expectations

| Failure | Expected outcome |
| --- | --- |
| One control-plane VM or Proxmox host | etcd retains quorum, but loss of the configured `10.30.0.6` API endpoint can still interrupt API access. |
| One main worker | Most paired applications keep one serving replica. Database, Redis, Elasticsearch, and metrics members promote or continue from the other worker; capacity and redundancy are reduced until recovery. |
| RTX worker | User-facing data members remain, but third-vote quorum services lose failure tolerance. Stalwart's Redis HAProxy path and some quorum-dependent failovers may be interrupted. |
| NFS or Garage host | Services using that backend can become read-only, fail requests, or stop despite healthy Kubernetes replicas. |
| Argo CD or an operator | Existing workloads generally continue serving, but reconciliation, repair, and controlled failover may pause. |
| Both main workers | Most application and online data tiers are unavailable. Recovery requires restored workers, local volumes or backups, plus the external NFS and Garage data. |

Use [Disaster recovery](/admin-guide/disaster-recovery/) for the recovery set and rebuild order.

## Use the application-specific explanation

The tables summarize the repository design. Each service’s [Infrastructure Explanation](/infrastructure/) expands its component paths and recovery set, and its administrator guide explains required integration work. No entry here asserts that a fresh failover drill or live inspection has been performed.
