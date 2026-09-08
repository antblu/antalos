---
title: "SuiteCRM \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for SuiteCRM in Antalos."
---

<nav class="guide-switcher" aria-label="SuiteCRM guide sections"><a href="/user-guide/suitecrm/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/suitecrm/">Infrastructure Explanation</a><a href="/admin-guide/suitecrm/">Deployment and Admin Guide</a></nav>

Two web replicas share the `suitecrm-data` NFS volume. A single messenger worker and a scheduled CronJob handle background work. The MariaDB operator manages two Galera data members on the main workers; a `garbd` process on RTX adds a third vote without storing a full database. The bootstrap Job initializes the shared installation. Daily physical database backups target Garage.

## Component boundaries

<figure class="architecture-diagram" aria-label="SuiteCRM · component flow">
<div class="diagram-heading">SuiteCRM · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">CRM users</span><ul><li>Browser → SAML</li><li>Traefik HTTPS</li></ul></li><li class="diagram-stage"><span class="diagram-label">Application</span><ul><li>2 web replicas / shared NFS</li><li>1 messenger / scheduler Job</li></ul></li><li class="diagram-stage"><span class="diagram-label">Database and backup</span><ul><li>2 Galera data + RTX garbd vote</li><li>Daily physical backup → Garage</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Back up MariaDB and the NFS application data together, including uploaded files and custom configuration. Preserve the SAML service-provider key and identity-provider certificate. The `PhysicalBackup` resource covers the database; it does not itself back up NFS.

## Availability and failure behavior

Partial availability: two web and database members support a single-node failure, but the messenger process, scheduled work, NFS, and external backup endpoint have separate limits. `garbd` contributes quorum and cannot restore a lost database.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/suitecrm/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/app.yaml)
- [`backup.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/backup.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/database.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/secrets.yaml)
- [`storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/storage.yaml)
- [`suitecrm.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/suitecrm.yaml)

## Continue

Read the [deployment guide](/admin-guide/suitecrm/) for dependency order, initial credentials, and integration work. The [official documentation](https://docs.suitecrm.com/user/) explains the upstream product; the topology above describes this repository.
