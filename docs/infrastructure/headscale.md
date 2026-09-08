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

**Availability classification: Not continuously HA: Headscale and Headplane each recover by restarting one process.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Headscale | 1 StatefulSet pod | No second server is ready to take over control-plane requests. |
| Headplane | 1 Deployment pod; Recreate | The management interface has its own single-process outage. |
| Databases | Two separate local SQLite databases | Litestream copies each database into its NFS backup directory. |
| Backup target | One external NFS service | Replacement pods restore the latest available copy before serving. |

### How a failure is handled

Kubernetes must detect the failure and start a replacement on an eligible node. Initialization restores the relevant SQLite database from NFS, then the process starts with its original configuration and credentials. That is restart-and-restore recovery, not routing to a hot standby.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | If it hosts Headscale, registration and control updates stop until recovery. If it hosts Headplane, browser administration stops independently. Already-established client tunnels may continue using existing peer state, but new enrollment, policy distribution, or reconnection must not be assumed available. |
| RTX worker only | No dedicated voter is involved. Headscale startup also depends on OIDC discovery under the checked-in only-start-if-available setting, so Authentik must be reachable during recovery. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

Single-replica updates interrupt the corresponding service; Headplane uses Recreate. Do not scale SQLite writers to two as an HA shortcut without a supported coordination/storage redesign.

### What prevents a stronger HA claim

Unreplicated recent SQLite changes may be absent from the restored backup. NFS loss prevents dependable backup/restore. Restoring both applications requires both databases, not just the Headscale one.

### What would improve the availability contract

State a measured recovery-time and recovery-point objective, protect NFS and sealing material, and rehearse both restores. Continuous service availability would require a supported application/storage topology beyond the current singleton design.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

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
