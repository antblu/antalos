---
title: "MariaDB operator · Architecture"
description: "MariaDB operator reconciliation and Galera application dependencies."
---

<nav class="guide-switcher" aria-label="MariaDB operator guide sections"><a href="/user-guide/mariadb-operator/">Use</a><a aria-current="page" href="/infrastructure/mariadb-operator/">Architecture</a><a href="/admin-guide/mariadb-operator/">Operate</a></nav>

`app.yaml` defines two Argo Applications: CRDs at sync wave -10 and the operator at -9. The operator and webhook each have two replicas with anti-affinity and disruption budgets. SuiteCRM’s two Galera data members and RTX arbitrator are declared in `apps/suitecrm/`.

## Components

<figure class="architecture-diagram" aria-label="MariaDB operator · component flow">
<div class="diagram-heading">MariaDB operator · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Install / declare</span><ul><li>CRDs → operator</li><li>MariaDB / User / Grant resources</li></ul></li><li class="diagram-stage"><span class="diagram-label">Manage</span><ul><li>2 operator replicas</li><li>2 admission webhooks</li></ul></li><li class="diagram-stage"><span class="diagram-label">SuiteCRM database</span><ul><li>2 Galera members + garbd</li><li>PhysicalBackup → Garage</li></ul></li></ol>
</figure>

## Data and recovery

The operator installation is reconstructable. MariaDB data, physical backups, root/application credentials, and S3 credentials belong to SuiteCRM’s recovery set. The arbitrator stores no recoverable application database.

## Availability and failure behavior

**HA management design: replicated operator and webhook; database HA still belongs to each managed MariaDB.**

The expected behavior assumes healthy replicas with the intended placement and reachable dependencies. Verify it in a failure drill on your deployment.

### Component redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Operator | 2 anti-affined replicas | Leader-election/control-loop recovery can retain an available manager. |
| Webhook | 2 anti-affined replicas | Admission routes to surviving endpoints. |
| Disruption/update | PDB maxUnavailable 1; zero surge/one unavailable | Protects one management/webhook process during intended maintenance. |
| Managed state | SuiteCRM Galera + database resources | Database quorum and data copies are separate from operator replicas. |

### Failover and recovery

Losing a management pod leaves another eligible controller to continue under the operator’s leadership model. Admission uses a surviving webhook. SQL requests continue through the MariaDB data service independently of HTTP traffic to the operator, although management is needed for repair.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | One controller and webhook can remain. If the same worker held a Galera data node, the database separately needs its surviving data member and arbitrator to retain membership. |
| RTX worker only | The SuiteCRM arbitrator can be lost independently of operator replicas. Whole-host API loss still interrupts management and recovery operations. |
| A second failure before recovery | Check surviving endpoints and capacity before further maintenance. For replicated data or voting groups, check the remaining copies and quorum. |

Losing the RTX Proxmox host takes down both its worker and control-plane VMs, including the default external API endpoint. Factor that dependency into [whole-host failure testing](/infrastructure/availability/#physical-hosts-and-the-api-endpoint).

### Upgrades and voluntary maintenance

CRDs reconcile before the operator through waves -10 and -9. Management rollouts use zero surge and one unavailable; incompatible CRD/operator changes can still block reconciliation.

### Availability limits

Two managers do not create a third SQL data copy, make NFS redundant, or prove a database backup is restorable. Leader transition and API availability still introduce possible management delays.

### Improving availability

Record management/webhook continuity and Galera membership changes separately. Keep schema/CRD version compatibility and physical-backup restoration part of the database service contract.

See [platform availability](/infrastructure/availability/) for shared dependencies and failure-test criteria.

## Configuration ownership

Keep Kubernetes resources in `apps/mariadb-operator/` and environment-specific inputs in `apps/variables.yaml`. Use the application’s backup procedure for any settings it stores in its database.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/mariadb-operator/app.yaml)

## Related guides

- [deployment guide](/admin-guide/mariadb-operator/) for setup and recovery
- [official documentation](https://github.com/mariadb-operator/mariadb-operator) for product configuration
