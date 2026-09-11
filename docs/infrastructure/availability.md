---
title: Service availability
description: Which Antalos services are highly available, how failover works, and where single processes, storage, quorum, or upgrades limit availability.
sidebar:
  order: 2
---

Antalos has **mixed availability**. Several serving tiers can use a healthy replica after one worker fails. Others must restart a single process or restore a database before serving again. Replicated applications can still lose functionality through shared storage, a singleton proxy, or an unavailable control-plane endpoint.

This reference describes the current repository design. It does not report live readiness, a completed node-loss test, an uptime percentage, or a measured recovery time. Follow each service link for its component counts, failure sequence, upgrade behavior, and remaining work.

## Which applications are HA?

- **HA serving designs:** the documentation site and BentoPDF have interchangeable stateless replicas; Traefik has two serving proxies; Rancher has a replicated management web tier. These still depend on the shared network/control-plane paths. The docs rollout has a placement limitation described below.
- **Replicated stateful designs:** LiteLLM, Grafana, and the VictoriaMetrics metrics tier include application/data redundancy and a client path to surviving members. They can have a failover interval and reduced durability/capacity during degradation. They are not guarantees against every whole-host or external-service failure.
- **Partially HA applications:** Authentik, GitLab, Nextcloud, Open WebUI, SuiteCRM, Stalwart, and Zammad have replicated important components but retain shared dependencies, singleton features, restart/rejoin concerns, or upgrade outages. The scope of each limitation matters more than the replica total.
- **Not continuously HA:** Headscale, Headplane, Vaultwarden’s application, UrBackup, and RustDesk rendezvous each run one primary application process. Kubernetes restart and persistent backups provide recovery, with an outage. RustDesk’s two native relays improve relay choice but do not make rendezvous HA.
- **Not replicated log storage:** VictoriaLogs has two storage processes holding shards, not two complete copies. Grafana availability must not be used as evidence that all historical logs are available.
- **External or not established here:** NFS/Garage server HA, public routing/DNS resilience, and the external Talk recorder require their own architecture and evidence.

### What the labels mean

| Term | Meaning in these guides |
| --- | --- |
| HA serving tier | Another ready process can serve new requests when one serving process/node fails, assuming its dependencies remain usable. |
| HA data design | Independent data copies, a supported promotion/election mechanism, and a client path to the surviving writer/reader. A transition can interrupt requests. |
| Partially HA | Some components meet those conditions, but an important workflow or dependency still has an outage path. |
| Recovery-based / not continuously HA | Service returns by restarting, rescheduling, remounting, or restoring one process/data copy; there is no hot alternative for that function. |
| Not established by manifests | Replica/default behavior or an external dependency has not been explicitly specified sufficiently to support the claim. |

No service should be described as unconditionally end-to-end HA solely because it has two pods. Define the failure being tolerated and the user transaction that must still work.

## Application-by-application classification

| Service | Availability conclusion | Mechanism and limits |
| --- | --- | --- |
| [Authentik](/infrastructure/authentik/#availability-and-failure-behavior) | Partially HA: replicated identity processing and database; external shared media and maintenance limits remain. | 2; required anti-affinity; see the linked component table for the data, routing, and recovery path. |
| [BentoPDF](/infrastructure/bentopdf/#availability-and-failure-behavior) | HA static serving tier; access depends on the shared identity and ingress services. | 2 stateless pods on separate nodes; see the linked component table for the data, routing, and recovery path. |
| [Documentation](/infrastructure/docs/#availability-and-failure-behavior) | HA static serving tier for node loss; current zero-unavailable rollout can be blocked by placement. | 2 stateless replicas; required host anti-affinity; see the linked component table for the data, routing, and recovery path. |
| [GitLab](/infrastructure/gitlab/#availability-and-failure-behavior) | Partially HA as a complete service: extensive replication, with external storage and failover/recovery prerequisites. | Webservice, Sidekiq, Shell, KAS, registry, toolbox: 2 each; see the linked component table for the data, routing, and recovery path. |
| [Headscale / Headplane](/infrastructure/headscale/#availability-and-failure-behavior) | Not continuously HA: Headscale and Headplane each recover by restarting one process. | 1 StatefulSet pod; see the linked component table for the data, routing, and recovery path. |
| [LiteLLM](/infrastructure/litellm/#availability-and-failure-behavior) | HA design for a single data-worker loss, conditional on healthy control-plane, Sentinel communication, and upstream providers. | 2 anti-affined replicas on the main workers; see the linked component table for the data, routing, and recovery path. |
| [Nextcloud](/infrastructure/nextcloud/#availability-and-failure-behavior) | Partially HA overall: replicated web and many companions, with shared storage, session, Redis recovery, and upgrade limits. | 2 anti-affined web-sidecar pairs; see the linked component table for the data, routing, and recovery path. |
| [Open WebUI](/infrastructure/open-webui/#availability-and-failure-behavior) | Partially HA: steady-state replicas exist, but Recreate upgrades and Redis/storage dependencies can interrupt all users. | 2 anti-affined pods on main workers; see the linked component table for the data, routing, and recovery path. |
| [Rancher](/infrastructure/rancher/#availability-and-failure-behavior) | HA management web tier; it is not an independent control plane for recovering this cluster. | 2 replicas with required host anti-affinity; see the linked component table for the data, routing, and recovery path. |
| [RustDesk](/infrastructure/rustdesk/#availability-and-failure-behavior) | Not continuously HA end to end: one recoverable rendezvous server, with two independent native relays. | 1 Deployment replica; see the linked component table for the data, routing, and recovery path. |
| [Stalwart Mail](/infrastructure/stalwart/#availability-and-failure-behavior) | Partially HA; loss of the RTX-only Redis proxy is an explicit single-worker failure gap. | 2 anti-affined Stalwart replicas; see the linked component table for the data, routing, and recovery path. |
| [SuiteCRM](/infrastructure/suitecrm/#availability-and-failure-behavior) | Partially HA: replicated web and Galera data, but background workers and shared files have separate outage paths. | 2 anti-affined replicas; see the linked component table for the data, routing, and recovery path. |
| [UrBackup](/infrastructure/urbackup/#availability-and-failure-behavior) | Not HA: one backup server, restored with two external NFS exports. | 1 Deployment replica; see the linked component table for the data, routing, and recovery path. |
| [Vaultwarden](/infrastructure/vaultwarden/#availability-and-failure-behavior) | Not HA at the application layer: one vault server; PostgreSQL alone is replicated. | 1 Recreate replica; see the linked component table for the data, routing, and recovery path. |
| [Grafana / metrics / logs](/infrastructure/victoriametrics/#availability-and-failure-behavior) | Mixed availability: Grafana and metrics have replicated designs; the current log storage is sharded, not redundantly copied. | 2 anti-affined pods + 2 CNPG instances; see the linked component table for the data, routing, and recovery path. |
| [Zammad](/infrastructure/zammad/#availability-and-failure-behavior) | Partially HA: paired HTTP tiers and data services, with singleton real-time/background roles and Redis/search caveats. | 2 NGINX + 2 Rails replicas; see the linked component table for the data, routing, and recovery path. |

## How the HA mechanisms work

### Ready replicas and client routing

A typical stateless path is client → ingress → Service → ready application endpoint. Required pod anti-affinity separates replicas across Kubernetes node names. If a member fails, the system must detect that condition and route new traffic to a surviving ready endpoint. Probe intervals, endpoint updates, network convergence, and client retry behavior all contribute to the interruption.

A readiness probe only establishes the condition it actually checks. A listening TCP port may not prove database writability or a successful object upload. New-request availability also says nothing about moving an in-flight stream, WebSocket session, mail connection, or TURN allocation between processes.

### PostgreSQL promotion

CNPG manages a primary and a streaming standby for each two-instance cluster. They use separate OpenEBS volumes; the second copy comes from PostgreSQL replication, not from the StorageClass. If the primary fails, the surviving standby must become the writer and the read/write Service must identify it. Clients must reconnect. The operator and Kubernetes API are part of this failover path.

| Application database | Explicit policy in this repository | Durability implication |
| --- | --- | --- |
| Authentik, Nextcloud/Context Chat, Stalwart | No synchronous stanza | Default asynchronous replication; recent primary writes may not yet be on the standby. |
| LiteLLM, Open WebUI, Vaultwarden, Zammad, Grafana | any / 1 / preferred | Requests synchronous acknowledgement while possible, but permits degraded operation without the standby. |
| GitLab and Praefect databases | any / 1 / preferred on both clusters | Each database has a separate promotion and degraded-durability boundary. |

These settings do not promise zero loss under every failure sequence. See [CNPG replication and durability](https://cloudnative-pg.io/docs/1.28/replication/) for the mechanisms; use documentation matching the installed operator when administering it.

### Redis election and rejoin

Most bespoke Redis layouts use two data members and three Sentinel voters, one voter in each worker failure domain. With all three initially healthy, losing one data worker leaves one data copy and two voters. Election still requires communicating voters and an eligible replica; a Sentinel-only pod cannot serve application data.

| Consumer | Client path | Restart/rejoin behavior visible in its manifests |
| --- | --- | --- |
| LiteLLM | Direct authenticated Sentinel discovery | Data-side Redis role and Sentinel topology persist; startup queries peers before choosing a role. |
| GitLab | Direct Sentinel discovery | Sentinel topology persists; initialized data members wait for discovery rather than guessing a primary. |
| Open WebUI | Direct discovery; Sentinel listener auth follows its client contract | Initial data roles are assigned by ordinal; Sentinel configuration is temporary. |
| Zammad | Direct Sentinel discovery | Initial data roles are assigned by ordinal; Sentinel configuration is temporary. |
| Nextcloud | Two HAProxy replicas checking Redis ROLE | Same ordinal-based/temporary topology concern; proxy replication does not elect or fence writers. |
| Stalwart | One HAProxy inside the RTX quorum pod | Same restart concern plus a singleton client endpoint that is lost with RTX. |

The ordinal-based scripts can reintroduce an old role after promotion. That is a source-derived recovery concern, not a claim that a live split-brain event was observed. A useful failure drill includes the old primary’s return and confirms that all clients converge on one writer.

Keep data, replica, voter, and client authentication consistent. Password-only Sentinel setups use matching `requirepass` values for peer authentication; a missing separate `sentinel-pass` directive alone does not prove a defect. Redis replication is asynchronous. See [Redis Sentinel architecture and authentication](https://redis.io/docs/latest/operate/oss_and_stack/management/sentinel/).

### Quorum is not a data copy

| System | Third participant | What it protects | What it does not supply |
| --- | --- | --- | --- |
| SuiteCRM Galera | garbd on RTX | Membership majority with one surviving data node | A SQL-serving process or third database copy |
| Redis | Sentinel on RTX | Election voting | Another Redis dataset |
| Elasticsearch | Master-only node on RTX | Master-election majority | Replica shards for indices |
| GitLab repository tier | Full Gitaly member on RTX | Another repository data copy managed through Praefect | Availability of either PostgreSQL cluster or Garage |
| Talk messaging | Third NATS Core member | Redundant messaging connectivity | Persisted call media or a durable user-data quorum |

Galera’s connected majority can retain its Primary Component after a member loss; forced rebootstrap during a partition is a different recovery operation. See [Galera quorum](https://mariadb.com/docs/galera-cluster/galera-architecture/quorum-control-with-weighted-votes).

Elasticsearch also needs appropriate replica shards allocated across data nodes. Two data processes and a tiebreaker protect election, but do not by themselves establish a second copy of every index. See [Elastic’s small-cluster resilience guidance](https://www.elastic.co/docs/deploy-manage/production-guidance/availability-and-resilience/resilience-in-small-clusters).

Praefect routes and coordinates repository replication using its metadata database and repository state; three Praefect processes should not be described as an independent Raft quorum. See [Gitaly Cluster architecture](https://docs.gitlab.com/administration/gitaly/praefect/).

### Metrics replication versus log sharding

VictoriaMetrics declares a metrics replication factor of two and duplicate-scrape deduplication. A previously replicated sample can remain readable from a surviving copy. During degraded operation, fresh data may not receive two copies, and restoring a second storage process must not be assumed to backfill every missing historical sample automatically.

VictoriaLogs uses a different design: vlinsert distributes data across vlstorage shards. Losing one storage node removes access to that node’s history and can prevent complete queries. The remaining storage node is not its mirror. An explicit supported independent-copy ingestion/query architecture is needed for complete-history log HA. See [VictoriaLogs replication and availability](https://docs.victoriametrics.com/victorialogs/cluster/).

### Restart and restore

Headscale, Headplane, and RustDesk hbbs keep SQLite on local pod storage and copy it with Litestream to NFS. Replacement requires a usable backup, the right identity/credentials, and a safe single-writer startup. Backup interval is not the maximum possible data-loss interval when storage is slow or unreachable.

Vaultwarden and UrBackup also have single application processes, even though their state persists elsewhere. They return through replacement/restart, not through a ready hot application replica. Document that outage instead of presenting rescheduling as uninterrupted failover.

The three Ansible-managed application VMs are explicit singletons. `debian-arc`
hosts Talk recording, Immich remote machine learning, Jellyfin, and Docling.
`debian-left` hosts CPU-backed Nextcloud Live Transcription. `debian-rtx` hosts
llama.cpp and CUDA-backed Nextcloud Translate. Losing one VM or its physical
host removes only that VM's companion paths. Kubernetes services can retain
their primary functions, but these features return only after the affected VM
and Docker workloads recover.

## Shared failure domains

### Physical hosts and the API endpoint

The intended layout places one control-plane VM and one worker VM on each Proxmox host. Required anti-affinity uses Kubernetes node names; it only becomes physical-host separation because of that VM placement. If VMs are moved onto the same host later, node-name separation alone no longer protects against that host’s loss.

Three etcd members can retain a majority after one member fails. However, the configured client API address is `10.30.0.6` on the RTX control-plane VM; no VIP or API load balancer is defined. Losing the RTX **worker VM** removes its application voters. Losing the entire RTX **host** also removes the API address and can delay promotion, endpoint updates, scheduling, and reconciliation even though two etcd members remain.

Therefore, “survives one worker” must not be promoted to “survives any Proxmox host without interruption.” An available API endpoint is a prerequisite for stronger automatic failover claims.

### External storage and network

| Shared dependency | Affected paths | Why application replicas cannot replace it |
| --- | --- | --- |
| NFS at the declared external endpoint | Authentik media, Nextcloud code/recording content, SuiteCRM files, Vaultwarden data, UrBackup exports, SQLite backups | Every replica or replacement mounts the same external service. |
| Garage S3 at the declared external endpoint | Nextcloud files, GitLab objects/registry, Stalwart blobs, Open WebUI uploads, Zammad attachments, SuiteCRM media/database backups | Separate application pods still address the same object service. |
| Router, DNS, subnet, switches | Public and internal client access | The repository does not declare independent replacements for every network component. |
| Authentik | New SSO/forward-auth access | Application replica counts do not duplicate the identity service’s database/storage path. |
| CNPG/operator/API | Controlled state changes and database recovery | A standby does not independently guarantee the required controller action. |

The NFS and Garage defaults reference the same external host address. Its loss can affect several services at once. The repository does not establish whether an external implementation has its own failover; document that separately before assuming it.

## Availability during maintenance

| Configuration | Effect | Current examples |
| --- | --- | --- |
| 2 replicas, zero surge, one unavailable | Replaces one pod without needing a third anti-affined placement; leaves reduced capacity | LiteLLM proxies, BentoPDF, Traefik, Nextcloud web, SuiteCRM web, Grafana |
| 2 replicas, one surge, zero unavailable, hard anti-affinity | Can stall if both eligible nodes already hold old replicas | Documentation serving pods, Nextcloud Redis HAProxy |
| Recreate application | Can stop the full application during an upgrade regardless of steady-state replicas | Open WebUI, Vaultwarden; also single Headplane and Stalwart’s Redis proxy |
| PDB minimum 1 on a singleton | Blocks ordinary eviction; does not make a hot replacement or prevent its workload-controller update | RustDesk hbbs, UrBackup |
| Chart defaults without explicit overrides | Requires the actual chart policy before claiming a particular maintenance guarantee | Rancher and several platform controllers |

A PDB limits voluntary evictions; node failure and workload-controller rolling changes have different rules. It is not a minimum healthy-pod guarantee under every event. See [Kubernetes disruption behavior](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/).

Database migrations, reindexing, cache elections, and stateful sessions can still need a maintenance interval. Follow the application administrator guide instead of treating a rolling Deployment as a zero-downtime schema upgrade.

## Platform-service classification

| Service | Availability conclusion | Detailed explanation |
| --- | --- | --- |
| Argo CD | Partially HA overall: replicated API/rendering and Redis HA design; reconciliation and SSO are not proven by those counts. | [Replica, failure, and maintenance contract](/infrastructure/argocd/#availability-and-failure-behavior) |
| Traefik | HA ingress process tier for one serving-node loss; upstream routing and established connections remain separate. | [Replica, failure, and maintenance contract](/infrastructure/traefik/#availability-and-failure-behavior) |
| MetalLB | Partially HA: distributed address advertisement; controller allocation and the physical network remain separate. | [Replica, failure, and maintenance contract](/infrastructure/metallb/#availability-and-failure-behavior) |
| cert-manager | Partially HA: replicated admission webhook; certificate issuance is not fully replicated by the manifest. | [Replica, failure, and maintenance contract](/infrastructure/cert-manager/#availability-and-failure-behavior) |
| CloudNativePG operator | Not explicitly HA as an operator; it manages replicated database clusters with separate availability contracts. | [Replica, failure, and maintenance contract](/infrastructure/cnpg-operator/#availability-and-failure-behavior) |
| MariaDB operator | HA management design: replicated operator and webhook; database HA still belongs to each managed MariaDB. | [Replica, failure, and maintenance contract](/infrastructure/mariadb-operator/#availability-and-failure-behavior) |
| Metrics Server | Not explicitly HA: resource-metrics collection can pause until its chart workload recovers. | [Replica, failure, and maintenance contract](/infrastructure/metrics-server/#availability-and-failure-behavior) |
| NFS CSI | Not HA storage: the CSI path has node coverage, but all declared exports depend on one external endpoint. | [Replica, failure, and maintenance contract](/infrastructure/nfs-driver/#availability-and-failure-behavior) |
| OpenEBS | Not replicated storage: individual LocalPV volumes cannot survive loss of their owning disk as live copies. | [Replica, failure, and maintenance contract](/infrastructure/openebs/#availability-and-failure-behavior) |
| Sealed Secrets | Not explicitly HA as a controller; existing generated Secrets remain available independently of its process. | [Replica, failure, and maintenance contract](/infrastructure/sealed-secrets/#availability-and-failure-behavior) |

Argo CD’s controller replicas are configured with cluster sharding. They do not by themselves prove hot takeover of the one managed cluster’s work; SSO and auxiliary chart components also need their own replica assessment. See [Argo CD HA and sharding](https://argo-cd.readthedocs.io/en/stable/operator-manual/high_availability/).

## Describe recovery objectives honestly

**Recovery time (RTO)** is the interruption until the required user workflow works again. **Recovery point (RPO)** describes the data that may be absent after recovery. Neither is established by a pod count, a five-second failure-detection threshold, or a one-second backup interval.

For Antalos, the relevant intervals can include failure detection, voting, promotion, Service updates, rescheduling, image download, NFS locks, restore, replay, warm-up, and client reconnect. Correlated operator/API loss adds another dependency. Do not publish a numeric guarantee without measuring the complete path.

Replication is also not a backup: destructive changes or corruption can reach another live member. A recovery set needs independent database, object, file, and key material. See [disaster recovery](/admin-guide/disaster-recovery/).

## What would establish the claimed behavior

These are the evidence an administrator should capture in an authorized drill, not checks executed while editing this guide:

1. Identify the exact failure: one pod, one worker VM, one Proxmox host, a network partition, or the external storage host.
2. Confirm initial data copies, voter membership, physical separation, and enough surviving capacity; do not start already degraded.
3. Perform a real transaction continuously through the event: file upload/download, mail send/read, Git push/clone, model request, backup/restore, or a complete log query as appropriate.
4. Record the failed and elected writers, lost/interrupted sessions, time to useful service, and any missing data.
5. Return the old member safely and confirm a single correct writer, completed resynchronization, restored quorum, and complete data/query results.
6. Record Argo sync/health separately from application results and persist any repair in the source manifests.

Do not begin a second node’s maintenance just because replacement pods are Running. Full redundancy requires healthy copies, correct roles, and usable endpoints again.
