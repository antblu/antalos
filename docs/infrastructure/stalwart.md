---
title: "Stalwart Mail \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for Stalwart Mail in Antalos."
---

<nav class="guide-switcher" aria-label="Stalwart Mail guide sections"><a href="/user-guide/stalwart/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/stalwart/">Infrastructure Explanation</a><a href="/admin-guide/stalwart/">Deployment and Admin Guide</a></nav>

Two Stalwart replicas share a two-instance PostgreSQL cluster, Garage blob storage, Redis, and Elasticsearch. Redis has two data members and three Sentinel voters, but its HAProxy endpoint is colocated with the RTX quorum pod. Elasticsearch has two data/master members and a third master-only voter. A bootstrap Job applies the initial declarative settings; mail protocol listeners and HTTPS use separate routing paths.

## Component boundaries

<figure class="architecture-diagram" aria-label="Stalwart Mail · component flow">
<div class="diagram-heading">Stalwart Mail · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Mail clients</span><ul><li>SMTP / IMAP / other listeners</li><li>HTTPS administration</li></ul></li><li class="diagram-stage"><span class="diagram-label">Mail processing</span><ul><li>2 Stalwart replicas</li><li>Bootstrap settings Job</li></ul></li><li class="diagram-stage"><span class="diagram-label">Mail state</span><ul><li>PostgreSQL / Garage blobs</li><li>Redis → proxy on RTX</li><li>Elasticsearch · 2 data + 1 voter</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Back up PostgreSQL, Garage message blobs, sealed credentials, signing material, and declarative bootstrap configuration. Mail identity also depends on external DNS records. Replicated search and cache components are not independent backups of mailboxes.

## Availability and failure behavior

Partial availability: paired application and database members protect worker loss, but Garage is external and loss of the RTX Redis proxy can interrupt the configured Redis connection path. Mail sessions in progress may reconnect.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/stalwart/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/database.yaml)
- [`elasticsearch.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/elasticsearch.yaml)
- [`redis.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/redis.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/secrets.yaml)
- [`stalwart.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/stalwart.yaml)

## Continue

Read the [deployment guide](/admin-guide/stalwart/) for dependency order, initial credentials, and integration work. The [official documentation](https://stalw.art/docs/) explains the upstream product; the topology above describes this repository.
