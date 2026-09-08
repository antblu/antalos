---
title: "Vaultwarden \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for Vaultwarden in Antalos."
---

<nav class="guide-switcher" aria-label="Vaultwarden guide sections"><a href="/user-guide/vaultwarden/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/vaultwarden/">Infrastructure Explanation</a><a href="/admin-guide/vaultwarden/">Deployment and Admin Guide</a></nav>

One Vaultwarden application replica uses the chart’s Recreate strategy. PostgreSQL runs as a two-instance CNPG cluster, while `/data` is a retained shared NFS volume. Traefik provides HTTPS using `vaultwarden-tls`. Public signup is disabled and the chart references a sealed administrator token.

## Component boundaries

<figure class="architecture-diagram" aria-label="Vaultwarden · component flow">
<div class="diagram-heading">Vaultwarden · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Vault clients</span><ul><li>Bitwarden-compatible clients</li><li>Application authentication / HTTPS</li></ul></li><li class="diagram-stage"><span class="diagram-label">Vault server</span><ul><li>1 application replica</li><li>Recreate updates</li></ul></li><li class="diagram-stage"><span class="diagram-label">Durable state</span><ul><li>PostgreSQL · 2 instances</li><li>NFS /data + sealed credentials</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Preserve PostgreSQL, the NFS data directory, the administrator token, and database credentials. Attachments and other `/data` state must accompany the database backup. The original deployment’s data and keys must remain consistent during recovery.

## Availability and failure behavior

Recovery-based application with replicated PostgreSQL. The single application process and NFS dependency can interrupt all vault access even when a database standby survives. Clients may retain locally cached vault access according to their own lock settings.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/vaultwarden/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`admin-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/admin-secret.yaml)
- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/database.yaml)
- [`db-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/db-secret.yaml)
- [`storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/vaultwarden/storage.yaml)

## Continue

Read the [deployment guide](/admin-guide/vaultwarden/) for dependency order, initial credentials, and integration work. The [official documentation](https://github.com/dani-garcia/vaultwarden/wiki) explains the upstream product; the topology above describes this repository.
