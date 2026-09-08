---
title: "Headscale and Headplane \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for Headscale and Headplane in Antalos."
---

<nav class="guide-switcher" aria-label="Headscale and Headplane guide sections"><a href="/user-guide/headscale/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/headscale/">Infrastructure Explanation</a><a href="/admin-guide/headscale/">Deployment and Admin Guide</a></nav>

One Headscale StatefulSet and one Headplane Deployment share a hostname but use separate local SQLite databases. Each database lives on disposable local storage with Litestream replication to the shared NFS backup PVC. Startup restores the last backup before serving. Headplane calls the internal Headscale API using a mounted API key; browser login uses OIDC.

## Component boundaries

<figure class="architecture-diagram" aria-label="Headscale and Headplane · component flow">
<div class="diagram-heading">Headscale and Headplane · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Identity / clients</span><ul><li>Tailscale client → OIDC</li><li>Headplane browser → OIDC</li></ul></li><li class="diagram-stage"><span class="diagram-label">Single processes</span><ul><li>1 Headscale / SQLite</li><li>1 Headplane / SQLite → Headscale API</li></ul></li><li class="diagram-stage"><span class="diagram-label">Recovery</span><ul><li>Litestream copies both databases</li><li>NFS backups → startup restore</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Preserve both Litestream backup directories, Headscale configuration and key material included in the storage arrangement, the Headplane cookie secret, and sealed OIDC/API credentials. A surviving backup is needed when the disposable SQLite volume is recreated.

## Availability and failure behavior

Recovery-based: neither application has a hot replica. NFS availability and backup freshness determine restart recovery. OIDC discovery is configured as a Headscale startup dependency, so Authentik must be reachable when it starts.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/headscale/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/certificate.yaml)
- [`config.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/config.yaml)
- [`headplane-config.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/headplane-config.yaml)
- [`headplane-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/headplane-secret.yaml)
- [`headplane.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/headplane.yaml)
- [`headscale.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/headscale.yaml)
- [`oidc-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/oidc-secret.yaml)
- [`storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/storage.yaml)

## Continue

Read the [deployment guide](/admin-guide/headscale/) for dependency order, initial credentials, and integration work. The [official documentation](https://headscale.net/stable/) explains the upstream product; the topology above describes this repository.
