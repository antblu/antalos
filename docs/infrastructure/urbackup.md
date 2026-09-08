---
title: "UrBackup \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for UrBackup in Antalos."
---

<nav class="guide-switcher" aria-label="UrBackup guide sections"><a href="/user-guide/urbackup/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/urbackup/">Infrastructure Explanation</a><a href="/admin-guide/urbackup/">Deployment and Admin Guide</a></nav>

One UrBackup Deployment runs the upstream `uroni/urbackup-server` image. The configuration/database directory `/var/urbackup` and backup data at `/backups` use separate retained NFS volumes. The image starts with the capabilities it needs to switch to the configured `PUID` and `PGID`. HTTPS ingress exposes the web interface behind Authentik; the declared client ports are on a ClusterIP Service.

## Component boundaries

<figure class="architecture-diagram" aria-label="UrBackup · component flow">
<div class="diagram-heading">UrBackup · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Access</span><ul><li>UI → Authentik → ingress</li><li>Native clients need published transport</li></ul></li><li class="diagram-stage"><span class="diagram-label">Backup service</span><ul><li>1 UrBackup server</li><li>Configured PUID / PGID</li></ul></li><li class="diagram-stage"><span class="diagram-label">Two NFS exports</span><ul><li>/var/urbackup · configuration</li><li>/backups · backup payloads</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Both the configuration export and backup export are essential. Preserve client registration/database state along with stored backup files. An NFS claim’s requested size does not enforce a quota on the export; capacity must be managed on the NFS server.

## Availability and failure behavior

**Availability classification: Not HA: one backup server, restored with two external NFS exports.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Server | 1 Deployment replica | No other active process can continue server work immediately. |
| Configuration | NFS mounted at /var/urbackup | Server database/registration state survives a pod restart if the export survives. |
| Backup data | Separate NFS export at /backups | Backup payload persistence is external to the pod. |
| Eviction/update | PDB minimum 1; zero surge, one unavailable | Normal drain blocks; a controller update can still replace the only server. |

### How a failure is handled

Kubernetes recreates the failed server, remounts both exports, and starts it with the configured PUID/PGID. Clients reconnect and backup jobs resume or retry according to application state. Sharing the data on NFS permits relocation; it does not supply a running standby.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | If it hosts UrBackup, the UI and backup processing stop until the replacement starts and can access both exports. Neither readiness probes nor anti-affinity create a second replica. |
| RTX worker only | No dedicated voter. Recovery still needs the API/scheduler and external storage. Client routing must remain reachable independently of the web interface. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

Updates deliberately permit one unavailable replica, which here means the entire application. The singleton PDB can block drain until an administrator schedules the accepted outage; bypassing it does not create HA.

### What prevents a stronger HA claim

Both exports are required for a useful recovered installation. A backup of client files is not necessarily a backup of server registration/configuration. NFS failure can stop backup writes even with a Running server.

### What would improve the availability contract

Define a restart/recovery objective, protect both exports, and prove a client backup and restore after server recovery. Do not scale the server to multiple concurrent writers without an upstream-supported storage/coordination design.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/urbackup/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/urbackup/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/urbackup/certificate.yaml)
- [`storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/urbackup/storage.yaml)
- [`urbackup.yaml`](https://github.com/antblu/antalos/blob/main/apps/urbackup/urbackup.yaml)

## Continue

Read the [deployment guide](/admin-guide/urbackup/) for dependency order, initial credentials, and integration work. The [official documentation](https://www.urbackup.org/administration_manual.html) explains the upstream product; the topology above describes this repository.
