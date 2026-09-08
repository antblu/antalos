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

Recovery-based: there is one server process and an external NFS dependency. The `minAvailable: 1` budget blocks ordinary eviction of the single replica but does not make backup processing highly available.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/urbackup/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/urbackup/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/urbackup/certificate.yaml)
- [`storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/urbackup/storage.yaml)
- [`urbackup.yaml`](https://github.com/antblu/antalos/blob/main/apps/urbackup/urbackup.yaml)

## Continue

Read the [deployment guide](/admin-guide/urbackup/) for dependency order, initial credentials, and integration work. The [official documentation](https://www.urbackup.org/administration_manual.html) explains the upstream product; the topology above describes this repository.
