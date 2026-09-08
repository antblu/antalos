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

Replicated Argo components support node loss, but Git access and the Kubernetes API remain dependencies. Existing workloads can continue while reconciliation is down; new changes and repairs wait.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/argocd/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/argocd/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/argocd/certificate.yaml)
- [`secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/argocd/secret.yaml)

## Continue

Read the [deployment guide](/admin-guide/argocd/) for dependency order, initial credentials, and integration work. The [official documentation](https://argo-cd.readthedocs.io/en/stable/user-guide/) explains the upstream product; the topology above describes this repository.
