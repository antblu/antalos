---
title: "MariaDB operator \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for MariaDB operator in Antalos."
---

<nav class="guide-switcher" aria-label="MariaDB operator guide sections"><a href="/user-guide/mariadb-operator/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/mariadb-operator/">Infrastructure Explanation</a><a href="/admin-guide/mariadb-operator/">Deployment and Admin Guide</a></nav>

`app.yaml` defines two Argo Applications: CRDs at sync wave -10 and the operator at -9. The operator and webhook each have two replicas with anti-affinity and disruption budgets. SuiteCRM’s two Galera data members and RTX arbitrator are declared in `apps/suitecrm/`.

## Component boundaries

<figure class="architecture-diagram" aria-label="MariaDB operator · component flow">
<div class="diagram-heading">MariaDB operator · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Install / declare</span><ul><li>CRDs → operator</li><li>MariaDB / User / Grant resources</li></ul></li><li class="diagram-stage"><span class="diagram-label">Manage</span><ul><li>2 operator replicas</li><li>2 admission webhooks</li></ul></li><li class="diagram-stage"><span class="diagram-label">SuiteCRM database</span><ul><li>2 Galera members + garbd</li><li>PhysicalBackup → Garage</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

The operator installation is reconstructable. MariaDB data, physical backups, root/application credentials, and S3 credentials belong to SuiteCRM’s recovery set. The arbitrator stores no recoverable application database.

## Availability and failure behavior

**Availability classification: HA management design: replicated operator and webhook; database HA still belongs to each managed MariaDB.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Operator | 2 anti-affined replicas | Leader-election/control-loop recovery can retain an available manager. |
| Webhook | 2 anti-affined replicas | Admission routes to surviving endpoints. |
| Disruption/update | PDB maxUnavailable 1; zero surge/one unavailable | Protects one management/webhook process during intended maintenance. |
| Managed state | SuiteCRM Galera + database resources | Database quorum and data copies are separate from operator replicas. |

### How a failure is handled

Losing a management pod leaves another eligible controller to continue under the operator’s leadership model. Admission uses a surviving webhook. SQL requests continue through the MariaDB data service independently of HTTP traffic to the operator, although management is needed for repair.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | One controller and webhook can remain. If the same worker held a Galera data node, the database separately needs its surviving data member and arbitrator to retain membership. |
| RTX worker only | The SuiteCRM arbitrator can be lost independently of operator replicas. Whole-host API loss still interrupts management and recovery operations. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

CRDs reconcile before the operator through waves -10 and -9. Management rollouts use zero surge and one unavailable; incompatible CRD/operator changes can still block reconciliation.

### What prevents a stronger HA claim

Two managers do not create a third SQL data copy, make NFS redundant, or prove a database backup is restorable. Leader transition and API availability still introduce possible management delays.

### What would improve the availability contract

Record management/webhook continuity and Galera membership changes separately. Keep schema/CRD version compatibility and physical-backup restoration part of the database service contract.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/mariadb-operator/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/mariadb-operator/app.yaml)

## Continue

Read the [deployment guide](/admin-guide/mariadb-operator/) for dependency order, initial credentials, and integration work. The [official documentation](https://github.com/mariadb-operator/mariadb-operator) explains the upstream product; the topology above describes this repository.
