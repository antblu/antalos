---
title: "Headscale and Headplane · Architecture"
description: "Headscale coordination, Headplane, and SQLite recovery."
---

<nav class="guide-switcher" aria-label="Headscale and Headplane guide sections"><a href="/user-guide/headscale/">Use</a><a aria-current="page" href="/infrastructure/headscale/">Architecture</a><a href="/admin-guide/headscale/">Operate</a></nav>

One Headscale Deployment and one Headplane Deployment share a hostname but use separate local SQLite databases. Each database lives on disposable local storage with Litestream replication to the shared NFS backup PVC. Startup restores the last backup before serving. Headplane calls the internal Headscale API using a mounted API key; browser login uses OIDC.

## Components

<figure class="architecture-diagram" aria-label="Headscale and Headplane · component flow">
<div class="diagram-heading">Headscale and Headplane · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Identity / clients</span><ul><li>Tailscale client → OIDC</li><li>Headplane browser → OIDC</li></ul></li><li class="diagram-stage"><span class="diagram-label">Single processes</span><ul><li>1 Headscale / SQLite</li><li>1 Headplane / SQLite → Headscale API</li></ul></li><li class="diagram-stage"><span class="diagram-label">Recovery</span><ul><li>Litestream copies both databases</li><li>NFS backups → startup restore</li></ul></li></ol>
</figure>

## Data and recovery

Preserve both Litestream backup directories, Headscale configuration and key material included in the storage arrangement, the Headplane cookie secret, and sealed OIDC/API credentials. A surviving backup is needed when the disposable SQLite volume is recreated.

## Availability and failure behavior

**Not continuously HA: Headscale and Headplane each recover by restarting one process.**

The expected behavior assumes healthy replicas with the intended placement and reachable dependencies. Verify it in a failure drill on your deployment.

### Component redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Headscale | 1 Recreate Deployment pod | No second server is ready to take over control-plane requests. |
| Headplane | 1 Deployment pod; Recreate | The management interface has its own single-process outage. |
| Databases | Two separate local SQLite databases | Litestream copies each database into its NFS backup directory. |
| Backup target | One external NFS service | Replacement pods restore the latest available copy before serving. |

### Failover and recovery

Kubernetes must detect the failure and start a replacement on an eligible node. Initialization restores the relevant SQLite database from NFS, then the process starts with its original configuration and credentials. That is restart-and-restore recovery, not routing to a hot standby.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | If it hosts Headscale, registration and control updates stop until recovery. If it hosts Headplane, browser administration stops independently. Already-established client tunnels may continue using existing peer state, but new enrollment, policy distribution, or reconnection must not be assumed available. |
| RTX worker only | No dedicated voter is involved. Headscale startup also depends on OIDC discovery under the checked-in only-start-if-available setting, so Authentik must be reachable during recovery. |
| A second failure before recovery | Check surviving endpoints and capacity before further maintenance. For replicated data or voting groups, check the remaining copies and quorum. |

Losing the RTX Proxmox host takes down both its worker and control-plane VMs, including the default external API endpoint. Factor that dependency into [whole-host failure testing](/infrastructure/availability/#physical-hosts-and-the-api-endpoint).

### Upgrades and voluntary maintenance

Single-replica updates interrupt the corresponding service; Headplane uses Recreate. Do not scale SQLite writers to two as an HA shortcut without a supported coordination/storage redesign.

### Availability limits

Unreplicated recent SQLite changes may be absent from the restored backup. NFS loss prevents dependable backup/restore. Restoring both applications requires both databases, not just the Headscale one.

### Improving availability

State a measured recovery-time and recovery-point objective, protect NFS and sealing material, and rehearse both restores. Continuous service availability would require a supported application/storage topology beyond the current singleton design.

See [platform availability](/infrastructure/availability/) for shared dependencies and failure-test criteria.

## Configuration ownership

Keep Kubernetes resources in `apps/headscale/` and environment-specific inputs in `apps/variables.yaml`. Use the application’s backup procedure for any settings it stores in its database.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/certificate.yaml)
- [`config.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/config.yaml)
- [`headplane-config.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/headplane-config.yaml)
- [`headplane-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/headplane-secret.yaml)
- [`headplane.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/headplane.yaml)
- [`headscale.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/headscale.yaml)
- [`oidc-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/oidc-secret.yaml)
- [`storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/headscale/storage.yaml)

## Related guides

- [deployment guide](/admin-guide/headscale/) for setup and recovery
- [official documentation](https://headscale.net/stable/) for product configuration

Headscale uses a single Recreate Deployment restricted to the two general workers. Headscale and Headplane tolerate NotReady/unreachable nodes for 60 seconds before eviction. This permits replacement after a powered-off worker fails without waiting for a StatefulSet ordinal to clear. It does not fence a partitioned writer: confirm the old worker is powered off before takeover when connectivity is uncertain. RTX is excluded.

Before the controller migration, a Sync hook restores the existing Litestream backup into scratch storage using a read-only backup mount. An existing identity requires a successful restore; a missing identity alongside a database backup blocks migration. The Noise identity key and credentials remain unchanged. This provides recovery with an outage, not continuous availability.
