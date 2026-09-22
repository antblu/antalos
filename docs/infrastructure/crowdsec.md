---
title: CrowdSec · Architecture
description: Locate the Kubernetes security engine, log source, AppSec endpoint, and separate edge security instances.
---

<nav class="guide-switcher" aria-label="CrowdSec guides"><a href="/user-guide/crowdsec/">Use</a><a aria-current="page" href="/infrastructure/crowdsec/">Architecture</a><a href="/admin-guide/crowdsec/">Operate</a></nav>

The Kubernetes CrowdSec application has its own Local API, log processor, and AppSec component. It reads Traefik logs from VictoriaLogs and supplies the cluster's protection path. The Azure VM runs a separate engine and firewall bouncer.

## Component boundaries

| Component | Declared configuration | Dependency |
| --- | --- | --- |
| Local API (LAPI) | One replica with Recreate strategy | Pod-local SQLite restored and copied through Litestream to NFS |
| Log processor | One Deployment replica | VictoriaLogs query for the Traefik namespace/container |
| AppSec | One replica with Recreate strategy | Application-security requests on its declared endpoint |
| Traefik integration | Separate configuration in `apps/traefik/` | Correct API/bouncer credential and service endpoints |
| Azure protection | Guest engine, SSH collection, nftables bouncer | Azure VM logs and firewall |

The Kubernetes application explicitly treats its LAPI as authoritative for the Kubernetes processor, AppSec, and Traefik. It does not chain that LAPI to the separately managed OPNsense instance.

## Availability and failure behavior

**Singleton security components with a database restore path.** None of the three configured one-replica roles supplies a ready replacement during its own restart. Litestream makes database recovery possible when the NFS replica is usable; it does not provide a second active LAPI.

A stopped log processor can stop new detections. Failure of the API or AppSec has an effect determined by the consuming Traefik integration's error and cache behavior. Inspect that configuration before describing whether requests are allowed or blocked during an outage.

VictoriaLogs availability is a detection dependency, and its sharded storage is not a mirrored copy of all logs. The Azure engine remains a distinct security system with different logs and enforcement. See [networking](/infrastructure/networking/) for the full request path.

## Source and recovery

`apps/crowdsec/app.yaml` contains chart configuration and a plugin source for local support manifests. `storage.yaml`, `litestream.yaml`, and sealed credentials complete the declared state. Preserve database backups and the registration/bouncer identity consumed by the integration.

The [official CrowdSec architecture](https://docs.crowdsec.net/docs/intro/) explains the log processor, Local API, and enforcement roles. [Antalos administration](/admin-guide/crowdsec/) maps those roles to deployment work.
