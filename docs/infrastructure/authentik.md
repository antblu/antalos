---
title: "Authentik \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for Authentik in Antalos."
---

<nav class="guide-switcher" aria-label="Authentik guide sections"><a href="/user-guide/authentik/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/authentik/">Infrastructure Explanation</a><a href="/admin-guide/authentik/">Deployment and Admin Guide</a></nav>

The official chart runs two server replicas and two worker replicas with required pod anti-affinity. Servers handle browser and protocol requests; workers perform background tasks. Both use the two-instance `authentik-db` CloudNativePG cluster. `media-pvc.yaml` provides shared media from NFS. Traefik sends HTTPS to the server Service, while the embedded outpost supplies forward-auth decisions for protected ingresses.

## Component boundaries

<figure class="architecture-diagram" aria-label="Authentik · component flow">
<div class="diagram-heading">Authentik · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Identity requests</span><ul><li>Browser / OIDC / SAML</li><li>Traefik → Authentik Service</li></ul></li><li class="diagram-stage"><span class="diagram-label">Processing</span><ul><li>2 server replicas</li><li>2 worker replicas / embedded outpost</li></ul></li><li class="diagram-stage"><span class="diagram-label">Shared state</span><ul><li>PostgreSQL · 2 instances</li><li>NFS media / sealed application key</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Back up PostgreSQL, the media export, and the original `AUTHENTIK_SECRET_KEY`. The database holds users, provider definitions, policy bindings, and flows. Restoring pods from Git does not recreate provider configuration stored in that database.

## Availability and failure behavior

**Availability classification: Partially HA: replicated identity processing and database; external shared media and maintenance limits remain.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Server | 2; required anti-affinity | Service routes requests to ready servers; both use shared database state. |
| Worker | 2; required anti-affinity | Background processing has another worker after one is lost. |
| PostgreSQL | 2 CNPG instances; separate local volumes | Primary/standby streaming replication; no synchronous policy is declared. |
| Media | One external NFS endpoint | Both servers can mount the same files; no NFS-server failover is declared. |

### How a failure is handled

When a server disappears, new requests can reach the remaining ready server. If the failed worker also hosted the PostgreSQL primary, CNPG must promote the surviving standby and update the read/write endpoint before database-dependent requests recover. Connections and in-progress requests may need retries; server replicas do not bypass that database failover interval.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | One server, one worker, and one database instance can remain. This assumes the healthy members were on different hosts and the surviving worker has enough capacity for the full login/background workload. |
| RTX worker only | No dedicated Authentik data or voter is pinned to RTX. Losing only the RTX worker is different from losing the entire RTX host, which also removes the configured Kubernetes API endpoint. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

Server and worker rolling updates use zero surge and one unavailable replica. No application PDB is explicitly declared here, so do not assume a normal drain enforces a one-healthy-server minimum.

### What prevents a stronger HA claim

Asynchronous PostgreSQL replication can lose recent acknowledged writes after primary loss. NFS failure can break media-dependent requests and startup even with healthy application pods. An Authentik outage can affect new logins across dependent services; existing sessions have application-specific behavior.

### What would improve the availability contract

Protect or remove the shared-media failure boundary, explicitly budget voluntary disruption, protect the CNPG control path, and record a login/provider transaction during a controlled primary and worker failure.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/authentik/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/certificate.yaml)
- [`db-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/db-secret.yaml)
- [`db.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/db.yaml)
- [`email-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/email-secret.yaml)
- [`media-pvc.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/media-pvc.yaml)
- [`metrics.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/metrics.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/secrets.yaml)

## Continue

Read the [deployment guide](/admin-guide/authentik/) for dependency order, initial credentials, and integration work. The [official documentation](https://docs.goauthentik.io/) explains the upstream product; the topology above describes this repository.
