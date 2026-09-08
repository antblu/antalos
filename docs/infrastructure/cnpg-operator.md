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

The operator is not explicitly replicated. Existing PostgreSQL processes can continue serving during an operator outage, but promotion and repair may wait for it to return. Each database also has its own durability policy.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/cnpg-operator/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/cnpg-operator/app.yaml)

## Continue

Read the [deployment guide](/admin-guide/cnpg-operator/) for dependency order, initial credentials, and integration work. The [official documentation](https://cloudnative-pg.io/documentation/) explains the upstream product; the topology above describes this repository.
