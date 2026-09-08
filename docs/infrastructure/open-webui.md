---
title: "Open WebUI \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for Open WebUI in Antalos."
---

<nav class="guide-switcher" aria-label="Open WebUI guide sections"><a href="/user-guide/open-webui/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/open-webui/">Infrastructure Explanation</a><a href="/admin-guide/open-webui/">Deployment and Admin Guide</a></nav>

Two application replicas share `open-webui-db`, a two-instance PostgreSQL cluster with vector support. Redis has two persistent data nodes and a third Sentinel voter on RTX for distributed coordination. Uploaded objects use Garage. A migration Job handles database changes. The chart is configured with `Recreate`, so upgrades can stop both application replicas even though two run during steady state.

## Component boundaries

<figure class="architecture-diagram" aria-label="Open WebUI · component flow">
<div class="diagram-heading">Open WebUI · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Sign-in / chats</span><ul><li>Browser → Authentik OIDC</li><li>Traefik HTTPS</li></ul></li><li class="diagram-stage"><span class="diagram-label">Chat interface</span><ul><li>2 Open WebUI replicas</li><li>Migration Job / Recreate upgrades</li></ul></li><li class="diagram-stage"><span class="diagram-label">State and inference</span><ul><li>PostgreSQL + vectors · 2 instances</li><li>Redis · 2 data / 3 Sentinels</li><li>Garage uploads / model APIs</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

Back up PostgreSQL and the Garage bucket together. Preserve the shared `webui-secret-key` across both replicas and recovery, as well as the OIDC and provider credentials. Local application storage is not the authoritative chat or upload database.

## Availability and failure behavior

**Availability classification: Partially HA: steady-state replicas exist, but Recreate upgrades and Redis/storage dependencies can interrupt all users.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Web interface | 2 anti-affined pods on main workers | Shared application key and external state allow a surviving instance to serve. |
| PostgreSQL / vectors | 2 CNPG instances | Preferred synchronous replication with a stable writer endpoint. |
| Redis | 2 data members + 3 Sentinels | Client discovery selects a primary; the RTX member contributes a vote, not data. |
| Objects / models | Garage uploads + external model APIs | Neither dependency gains replicas from the Open WebUI Deployment. |

### How a failure is handled

New browser requests can reach the surviving instance after routing converges. Chats and knowledge state require the database and object store; distributed coordination requires a valid Redis primary. In-progress streams can stop and must be restarted by the client rather than moving to another process.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | One app, one database member, one Redis data member, and two Sentinel voters can remain. Sustained inference throughput depends on the model provider and surviving app capacity. |
| RTX worker only | Leaves both app/data workers and two data-side Sentinels. Another voter or data-worker loss is outside the intended single-failure margin. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

The chart explicitly uses Recreate. A version rollout may terminate both application replicas before starting their replacements; the application PDB does not turn a controller-driven Recreate update into a rolling one.

### What prevents a stronger HA claim

Redis roles are reconstructed from ordinal names at startup and Sentinel state is temporary. Promotion followed by restart needs special attention to prevent a returned member assuming the old primary. Sentinel listeners intentionally omit requirepass for the current client contract; data-node authentication is a separate setting. Garage or model-provider failure can make a healthy UI unusable for its main workflow.

### What would improve the availability contract

Document an upgrade outage unless a supported rolling/migration design is implemented. Establish Redis restart/rejoin correctness, durable backups, and a chat/upload test after failover. Keep the shared application secret identical across replicas and recovery.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/open-webui/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/app.yaml)
- [`availability.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/availability.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/database.yaml)
- [`migration.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/migration.yaml)
- [`redis.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/redis.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/secrets.yaml)

## Continue

Read the [deployment guide](/admin-guide/open-webui/) for dependency order, initial credentials, and integration work. The [official documentation](https://docs.openwebui.com/) explains the upstream product; the topology above describes this repository.
