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

The repository provides replicated application and repository paths, with an external Garage dependency. Gitaly Cluster on Kubernetes is an upstream beta feature. The third Gitaly is a substantial data workload on RTX; capacity planning must include its full repository copy. Failover can interrupt active pushes and jobs.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/gitlab/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/gitlab/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/gitlab/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/gitlab/database.yaml)
- [`redis.yaml`](https://github.com/antblu/antalos/blob/main/apps/gitlab/redis.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/gitlab/secrets.yaml)

## Continue

Read the [deployment guide](/admin-guide/gitlab/) for dependency order, initial credentials, and integration work. The [official documentation](https://docs.gitlab.com/user/) explains the upstream product; the topology above describes this repository.
