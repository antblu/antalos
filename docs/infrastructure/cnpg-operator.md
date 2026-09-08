---
title: "CloudNativePG \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for CloudNativePG in Antalos."
---

<nav class="guide-switcher" aria-label="CloudNativePG guide sections"><a href="/user-guide/cnpg-operator/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/cnpg-operator/">Infrastructure Explanation</a><a href="/admin-guide/cnpg-operator/">Deployment and Admin Guide</a></nav>

The operator chart runs in `cnpg-system`, while managed clusters run in application namespaces. Most clusters here have two instances on separate workers and separate OpenEBS LocalPV volumes. PostgreSQL replication supplies redundancy; OpenEBS does not replicate those volumes.

## Component boundaries

<figure class="architecture-diagram" aria-label="CloudNativePG · component flow">
<div class="diagram-heading">CloudNativePG · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Declare</span><ul><li>Application Cluster resource</li><li>Owner Secret / storage settings</li></ul></li><li class="diagram-stage"><span class="diagram-label">Manage</span><ul><li>CNPG operator</li><li>Primary selection / repair</li></ul></li><li class="diagram-stage"><span class="diagram-label">Database</span><ul><li>Primary + standby / rw Service</li><li>Separate local PVs / app backups</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Database data and backups belong to each managed cluster. The operator chart is reconstructable from Git. Preserve database credentials, backup credentials, WAL/base backups where configured, and the sealing key.

## Availability and failure behavior

**Availability classification: Not explicitly HA as an operator; it manages replicated database clusters with separate availability contracts.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Operator | Chart installed without explicit replica override | Reconciliation and promotion can wait for recovery if its active process is unavailable. |
| Managed databases | Usually 2 instances per application | PostgreSQL primary/standby replication runs in each application namespace. |
| Client routing | Per-cluster read/write Service | Must be directed to the correct elected/promoted writer. |
| Storage | Separate LocalPV volumes | The operator does not make one local volume portable or replicated. |

### How a failure is handled

If only the operator is lost, an existing primary and its standby can continue their PostgreSQL work. If a database primary is also lost, automatic promotion requires the relevant controller/API path to function. A database standby is useful but is not an independently complete failover controller.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | Database serving depends on whether the lost worker held the primary and/or operator. Correlated loss of a primary and the single operator may extend interruption beyond simple standby promotion. |
| RTX worker only | No operator-specific vote is declared. Whole-host API loss is especially significant because cluster observation and Service updates depend on it. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

Operator restarts and CRD upgrades can pause management while databases keep serving. Perform application database upgrades according to each cluster’s policy, not by treating the operator rollout as the database rollout.

### What prevents a stronger HA claim

No explicit operator replica count means this repository does not establish redundant management. Most databases have only one standby; after one member fails there is no second replica to absorb another loss.

### What would improve the availability contract

Make operator leader-election/replica behavior explicit for the pinned chart, protect API access, and measure primary loss both with and without a simultaneous operator disruption. Keep backup policy per database.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/cnpg-operator/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/cnpg-operator/app.yaml)

## Continue

Read the [deployment guide](/admin-guide/cnpg-operator/) for dependency order, initial credentials, and integration work. The [official documentation](https://cloudnative-pg.io/documentation/) explains the upstream product; the topology above describes this repository.
