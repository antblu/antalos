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

The management and webhook tiers are replicated. Database availability still depends on Galera quorum, data-member health, and local storage; operator replicas cannot replace missing database copies.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/mariadb-operator/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/mariadb-operator/app.yaml)

## Continue

Read the [deployment guide](/admin-guide/mariadb-operator/) for dependency order, initial credentials, and integration work. The [official documentation](https://github.com/mariadb-operator/mariadb-operator) explains the upstream product; the topology above describes this repository.
