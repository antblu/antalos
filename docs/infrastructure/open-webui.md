---
title: "Open WebUI · Architecture"
description: "Open WebUI, model connections, and persistent application state."
---

<nav class="guide-switcher" aria-label="Open WebUI guide sections"><a href="/user-guide/open-webui/">Use</a><a aria-current="page" href="/infrastructure/open-webui/">Architecture</a><a href="/admin-guide/open-webui/">Operate</a></nav>

Two application replicas share `open-webui-db`, a two-instance PostgreSQL cluster with vector support. Redis has two persistent data nodes and a third Sentinel voter on RTX for distributed coordination. Uploaded objects use Garage. A migration Job handles database changes. The chart is configured with `Recreate`, so upgrades can stop both application replicas even though two run during steady state.

## Components

<figure class="architecture-diagram" aria-label="Open WebUI · component flow">
<div class="diagram-heading">Open WebUI · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Sign-in / chats</span><ul><li>Browser → Authentik OIDC</li><li>Traefik HTTPS</li></ul></li><li class="diagram-stage"><span class="diagram-label">Chat interface</span><ul><li>2 Open WebUI replicas</li><li>Migration Job / Recreate upgrades</li></ul></li><li class="diagram-stage"><span class="diagram-label">State and inference</span><ul><li>PostgreSQL + vectors · 2 instances</li><li>Redis · 2 data / 3 Sentinels</li><li>Garage uploads / model APIs</li></ul></li></ol>
</figure>

## Data and recovery

Back up PostgreSQL and the Garage bucket together. Preserve the shared `webui-secret-key` across both replicas and recovery, as well as the OIDC and provider credentials. Local application storage is not the authoritative chat or upload database.

## Availability and failure behavior

**Partially HA: steady-state replicas exist, but Recreate upgrades and Redis/storage dependencies can interrupt all users.**

The expected behavior assumes healthy replicas with the intended placement and reachable dependencies. Verify it in a failure drill on your deployment.

### Component redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Web interface | 2 anti-affined pods on main workers | Shared application key and external state allow a surviving instance to serve. |
| PostgreSQL / vectors | 2 CNPG instances | Preferred synchronous replication with a stable writer endpoint. |
| Redis | 2 data members + 3 Sentinels | Client discovery selects a primary; the RTX member contributes a vote, not data. |
| Objects / models | Garage uploads + external model APIs | Neither dependency gains replicas from the Open WebUI Deployment. |

### Failover and recovery

New browser requests can reach the surviving instance after routing converges. Chats and knowledge state require the database and object store; distributed coordination requires a valid Redis primary. If a stream stops, retry the request from the client.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | One app, one database member, one Redis data member, and two Sentinel voters can remain. Sustained inference throughput depends on the model provider and surviving app capacity. |
| RTX worker only | Leaves both app/data workers and two data-side Sentinels. Another voter or data-worker loss is outside the intended single-failure margin. |
| A second failure before recovery | Check surviving endpoints and capacity before further maintenance. For replicated data or voting groups, check the remaining copies and quorum. |

Losing the RTX Proxmox host takes down both its worker and control-plane VMs, including the default external API endpoint. Factor that dependency into [whole-host failure testing](/infrastructure/availability/#physical-hosts-and-the-api-endpoint).

### Upgrades and voluntary maintenance

The chart explicitly uses Recreate. A version rollout may terminate both application replicas before starting their replacements; the application PDB does not turn a controller-driven Recreate update into a rolling one.

### Availability limits

Redis persists role changes and data-side Sentinel topology on each existing PVC. Startup consults Sentinel before rejoining; first migration of an existing dataset requires agreement from two voters. Verify promotion and former-primary rejoin before asserting automatic recovery. Sentinel listeners intentionally omit requirepass for the current client contract; data-node authentication is a separate setting. Garage or model-provider failure can make a healthy UI unusable for its main workflow.

### Improving availability

Document an upgrade outage unless a supported rolling/migration design is implemented. Establish Redis restart/rejoin correctness, durable backups, and a chat/upload test after failover. Keep the shared application secret identical across replicas and recovery.

See [platform availability](/infrastructure/availability/) for shared dependencies and failure-test criteria.

## Configuration ownership

Keep Kubernetes resources in `apps/open-webui/` and environment-specific inputs in `apps/variables.yaml`. Use the application’s backup procedure for any settings it stores in its database.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/app.yaml)
- [`availability.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/availability.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/database.yaml)
- [`migration.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/migration.yaml)
- [`redis.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/redis.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/open-webui/secrets.yaml)

## Related guides

- [deployment guide](/admin-guide/open-webui/) for setup and recovery
- [official documentation](https://docs.openwebui.com/) for product configuration

## Recovery resource limits

The serving container requests 512Mi and permits up to 3Gi. A worker-loss drill exposed a cgroup OOM at the former 2Gi limit on the surviving replica; evaluate actual general-worker memory headroom as well as scheduling reservations before increasing load. The metrics exporter explicitly selects Open WebUI's HTTP transport with `OTEL_METRICS_OTLP_SPAN_EXPORTER=http` for the configured VictoriaMetrics HTTP endpoint. This prevents the default TLS/gRPC exporter from retrying against that endpoint.

The two web replicas use zero-surge rolling updates with one unavailable replica, so applying a resource or configuration repair keeps a serving copy while its replacement starts.
