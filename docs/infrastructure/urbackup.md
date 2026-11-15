---
title: "UrBackup · Architecture"
description: "UrBackup server placement, client transports, and backup storage."
---

<nav class="guide-switcher" aria-label="UrBackup guide sections"><a href="/user-guide/urbackup/">Use</a><a aria-current="page" href="/infrastructure/urbackup/">Architecture</a><a href="/admin-guide/urbackup/">Operate</a></nav>

One UrBackup Deployment runs the upstream `uroni/urbackup-server` image. The configuration/database directory `/var/urbackup` and backup data at `/backups` use separate retained NFS volumes. The image starts with the capabilities it needs to switch to the configured `PUID` and `PGID`. HTTPS ingress exposes the web interface behind Authentik; the declared client ports are on a ClusterIP Service.

## Components

<figure class="architecture-diagram" aria-label="UrBackup · component flow">
<div class="diagram-heading">UrBackup · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Access</span><ul><li>UI → Authentik → ingress</li><li>Native clients need published transport</li></ul></li><li class="diagram-stage"><span class="diagram-label">Backup service</span><ul><li>1 UrBackup server</li><li>Configured PUID / PGID</li></ul></li><li class="diagram-stage"><span class="diagram-label">Two NFS exports</span><ul><li>/var/urbackup · configuration</li><li>/backups · backup payloads</li></ul></li></ol>
</figure>

## Data and recovery

Both the configuration export and backup export are essential. Preserve client registration/database state along with stored backup files. An NFS claim’s requested size does not enforce a quota on the export; capacity must be managed on the NFS server.

## Availability and failure behavior

**Not HA: one backup server, restored with two external NFS exports.**

The expected behavior assumes healthy replicas with the intended placement and reachable dependencies. Verify it in a failure drill on your deployment.

### Component redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Server | 1 Deployment replica | No other active process can continue server work immediately. |
| Configuration | NFS mounted at /var/urbackup | Server database/registration state survives a pod restart if the export survives. |
| Backup data | Separate NFS export at /backups | Backup payload persistence is external to the pod. |
| Eviction/update | PDB minimum 1; zero surge, one unavailable | Normal drain blocks; a controller update can still replace the only server. |

### Failover and recovery

Kubernetes recreates the failed server, remounts both exports, and starts it with the configured PUID/PGID. Clients reconnect and backup jobs resume or retry according to application state. Sharing the data on NFS permits relocation; it does not supply a running standby.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | If it hosts UrBackup, the UI and backup processing stop until the replacement starts and can access both exports. Neither readiness probes nor anti-affinity create a second replica. |
| RTX worker only | No dedicated voter. Recovery still needs the API/scheduler and external storage. Client routing must remain reachable independently of the web interface. |
| A second failure before recovery | Check surviving endpoints and capacity before further maintenance. For replicated data or voting groups, check the remaining copies and quorum. |

Losing the RTX Proxmox host takes down both its worker and control-plane VMs, including the default external API endpoint. Factor that dependency into [whole-host failure testing](/infrastructure/availability/#physical-hosts-and-the-api-endpoint).

### Upgrades and voluntary maintenance

Updates deliberately permit one unavailable replica, which here means the entire application. The singleton PDB can block drain until an administrator schedules the accepted outage; bypassing it does not create HA.

### Availability limits

Both exports are required for a useful recovered installation. A backup of client files is not necessarily a backup of server registration/configuration. NFS failure can stop backup writes even with a Running server.

### Improving availability

Define a restart/recovery objective, protect both exports, and prove a client backup and restore after server recovery. Do not scale the server to multiple concurrent writers without an upstream-supported storage/coordination design.

See [platform availability](/infrastructure/availability/) for shared dependencies and failure-test criteria.

## Configuration ownership

Keep Kubernetes resources in `apps/urbackup/` and environment-specific inputs in `apps/variables.yaml`. Use the application’s backup procedure for any settings it stores in its database.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/urbackup/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/urbackup/certificate.yaml)
- [`storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/urbackup/storage.yaml)
- [`urbackup.yaml`](https://github.com/antblu/antalos/blob/main/apps/urbackup/urbackup.yaml)

## Related guides

- [deployment guide](/admin-guide/urbackup/) for setup and recovery
- [official documentation](https://www.urbackup.org/administration_manual.html) for product configuration
