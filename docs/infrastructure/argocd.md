---
title: "Argo CD \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for Argo CD in Antalos."
---

<nav class="guide-switcher" aria-label="Argo CD guide sections"><a href="/user-guide/argocd/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/argocd/">Infrastructure Explanation</a><a href="/admin-guide/argocd/">Deployment and Admin Guide</a></nav>

OpenTofu installs the initial chart; `argocd-self` becomes the steady-state owner. The root app-of-apps reads `apps/` using `yaml-envsubst`, which discovers `app.yaml` files. Child sources render support manifests while excluding `app.yaml`, `values.yaml`, and `variables.yaml`. The bootstrap values define replicated server/controller/repo-server roles and Redis HA with Sentinel.

## Component boundaries

<figure class="architecture-diagram" aria-label="Argo CD · component flow">
<div class="diagram-heading">Argo CD · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Source</span><ul><li>Git / shared variables</li><li>Root app-of-apps</li></ul></li><li class="diagram-stage"><span class="diagram-label">Reconcile</span><ul><li>yaml-envsubst / Helm rendering</li><li>Replicated Argo controllers + Redis HA</li></ul></li><li class="diagram-stage"><span class="diagram-label">Desired state</span><ul><li>Child Applications</li><li>Kubernetes API → resources</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Git reconstructs desired state. Preserve repository credentials, Argo authentication secrets, the sealing key, and bootstrap state. Redis is control-plane support state rather than a backup of application databases.

## Availability and failure behavior

**Availability classification: Partially HA overall: replicated API/rendering and Redis HA design; reconciliation and SSO are not proven by those counts.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| API server | 2 replicas; hard anti-affinity | New UI/API requests can use the surviving server. |
| Repo server | 2 replicas; hard anti-affinity | Either can render Git inputs when Git and the plugin are available. |
| Application controller | 2 replicas; round-robin cluster sharding | Shards assign reconciliation work; a second replica is not automatically a hot copy of every cluster’s reconciliation loop. |
| Redis HA | 3 chart members; quorum toleration | Sentinel/proxy behavior follows the pinned chart; it is distinct from the bespoke app Redis scripts. |
| Dex / other chart roles | No explicit replica override in this file | Do not infer SSO or every auxiliary component is replicated. |

### How a failure is handled

API and manifest-rendering requests can retry on the surviving replicas. Redis failover depends on the chart’s HA configuration. Reconciliation for an affected controller shard depends on the rendered controller mode and shard recovery/redistribution; the two-replica value and heartbeat setting alone do not prove seamless takeover. A login path can also be unavailable while API requests with an existing token still work.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | Surviving serving replicas may continue, but an affected controller shard or unreplicated authentication component can pause operations. Already-running applications normally do not stop just because Argo cannot reconcile them. |
| RTX worker only | A Redis HA member may use the tainted worker because of its toleration. The whole RTX host also carries the configured Kubernetes API endpoint, making its loss a separate reconciliation dependency failure. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

Server/repo-server/proxy overrides use zero surge and one unavailable. Plugin subPath changes require repo-server replacement. Confirm chart-derived auxiliary replica and PDB behavior before promising seamless upgrades.

### What prevents a stronger HA claim

Git connectivity, the single configured API endpoint, potential auxiliary singletons, and shard recovery bound complete control-plane availability. A surviving web UI does not prove that manifests are being applied.

### What would improve the availability contract

Make authentication and controller recovery topology explicit, protect the API endpoint, and record both login/API access and reconciliation of the affected cluster during a controlled controller loss.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/argocd/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/argocd/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/argocd/certificate.yaml)
- [`secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/argocd/secret.yaml)

## Continue

Read the [deployment guide](/admin-guide/argocd/) for dependency order, initial credentials, and integration work. The [official documentation](https://argo-cd.readthedocs.io/en/stable/user-guide/) explains the upstream product; the topology above describes this repository.
