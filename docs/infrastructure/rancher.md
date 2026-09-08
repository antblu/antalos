---
title: "Rancher \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for Rancher in Antalos."
---

<nav class="guide-switcher" aria-label="Rancher guide sections"><a href="/user-guide/rancher/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/rancher/">Infrastructure Explanation</a><a href="/admin-guide/rancher/">Deployment and Admin Guide</a></nav>

The Rancher Helm release runs two replicas with required host anti-affinity in `cattle-system`. A second Argo CD Application, `rancher-config`, supplies the TLS certificate from the same service directory. Traefik terminates HTTPS using `rancher-tls`. Rancher depends on the Kubernetes API of this same cluster.

## Component boundaries

<figure class="architecture-diagram" aria-label="Rancher · component flow">
<div class="diagram-heading">Rancher · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Operators</span><ul><li>Browser / application login</li><li>Traefik / rancher-tls</li></ul></li><li class="diagram-stage"><span class="diagram-label">Management UI</span><ul><li>2 Rancher replicas</li><li>cattle-system namespace</li></ul></li><li class="diagram-stage"><span class="diagram-label">Managed state</span><ul><li>Kubernetes API / agents</li><li>Same cluster’s resources</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Rancher management state lives in Kubernetes resources and secrets; recovery must account for that state as well as the Helm values. Preserve the platform recovery set and use upstream Rancher backup procedures where configured.

## Availability and failure behavior

Two replicas protect the serving process from a node failure, but a cluster-wide API or ingress outage also removes the management UI. Keep the repository kubeconfig and Talos access available independently.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/rancher/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/rancher/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/rancher/certificate.yaml)

## Continue

Read the [deployment guide](/admin-guide/rancher/) for dependency order, initial credentials, and integration work. The [official documentation](https://ranchermanager.docs.rancher.com/) explains the upstream product; the topology above describes this repository.
