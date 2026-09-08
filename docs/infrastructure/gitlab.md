---
title: "GitLab \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for GitLab in Antalos."
---

<nav class="guide-switcher" aria-label="GitLab guide sections"><a href="/user-guide/gitlab/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/gitlab/">Infrastructure Explanation</a><a href="/admin-guide/gitlab/">Deployment and Admin Guide</a></nav>

The official chart separates webservice, Sidekiq, Shell, KAS, registry, and toolbox, with two replicas of these serving and support roles. Gitaly and Praefect each have three replicas across the workers; the RTX Gitaly member stores a full repository copy. Two independent two-instance CNPG clusters hold Rails and Praefect data. Redis has two persistent data members and three persistent Sentinel voters. Garage stores object payloads.

## Component boundaries

<figure class="architecture-diagram" aria-label="GitLab · component flow">
<div class="diagram-heading">GitLab · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Access</span><ul><li>Web / Git SSH / registry</li><li>Traefik / GitLab Shell</li></ul></li><li class="diagram-stage"><span class="diagram-label">Application and Git</span><ul><li>Paired web and support roles</li><li>3 Praefect + 3 full Gitaly copies</li></ul></li><li class="diagram-stage"><span class="diagram-label">Persistent services</span><ul><li>2 × 2-instance PostgreSQL clusters</li><li>2 Redis data + 3 Sentinels</li><li>External Garage bucket</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Recovery requires both PostgreSQL databases, the Gitaly repository data, Garage objects, and GitLab’s encryption, signing, SSH, and registry keys. The shared `gitlabs` bucket uses object prefixes and a registry prefix. Backup scheduling is disabled; this layout is incompatible with the stock Helm restore assumptions that require separate buckets.

## Availability and failure behavior

**Availability classification: Partially HA as a complete service: extensive replication, with external storage and failover/recovery prerequisites.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Serving and support roles | Webservice, Sidekiq, Shell, KAS, registry, toolbox: 2 each | Hard placement separation and role-specific Services provide surviving instances. |
| Repository routing/data | 3 Praefect; 3 Gitaly copies | Praefect coordinates repository routing and replication; RTX stores a full Gitaly copy. |
| PostgreSQL | Two clusters: GitLab and Praefect; 2 instances each | Each has its own primary/standby, read/write endpoint, and preferred synchronous policy. |
| Redis | 2 data members + 3 persistent Sentinels | Clients use Sentinel discovery; restarted data members query Sentinel before choosing a role. |
| Objects | External Garage bucket | Registry and Rails object data retain a shared external dependency. |

### How a failure is handled

A web/Shell/registry request can retry against its surviving frontend. Repository operations additionally need Praefect’s metadata database and an up-to-date Gitaly repository copy; three Praefect processes are not an independent Raft consensus cluster. PostgreSQL promotion and Redis election may interrupt requests and jobs. A surviving Gitaly process alone does not prove the selected repository has a current usable replica.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | Paired application roles, one instance of each PostgreSQL cluster, one Redis data member, and two repository members can remain. Both surviving Sentinel voters must communicate correctly. The remaining worker and RTX also need enough CPU, memory, and disk headroom for degraded operation. |
| RTX worker only | Removes a full Gitaly copy, one Praefect process, and the third Sentinel. Two repository members and two Sentinel voters remain; further data-worker loss is outside the single-failure envelope. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

Paired Deployments use zero surge and one unavailable; repository StatefulSets update incrementally. Run chart migrations in the declared order. A schema change or queue retry can affect availability even when a frontend pod remains Ready.

### What prevents a stronger HA claim

Garage failure affects objects/registry even with healthy Git storage. Preferred synchronous PostgreSQL can acknowledge writes without a standby. The protected Sentinel listeners require matching credentials across voters and client libraries that authenticate discovery requests; three listening ports alone are not election evidence. The stock Helm restore workflow also conflicts with the shared-bucket layout.

### What would improve the availability contract

Establish Sentinel peer-authentication/election evidence, test repository correctness through loss and rejoin, protect Garage, and create a restorable backup covering both databases, repositories, objects, and application keys. Review the upstream support status of Gitaly Cluster on Kubernetes.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/gitlab/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/gitlab/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/gitlab/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/gitlab/database.yaml)
- [`redis.yaml`](https://github.com/antblu/antalos/blob/main/apps/gitlab/redis.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/gitlab/secrets.yaml)

## Continue

Read the [deployment guide](/admin-guide/gitlab/) for dependency order, initial credentials, and integration work. The [official documentation](https://docs.gitlab.com/user/) explains the upstream product; the topology above describes this repository.
