---
title: Mautic infrastructure
description: Mautic serving, Galera quorum, Redis Sentinel, and shared NFS storage.
---

Mautic is owned by `apps/mautic/`. Shared versions, hostnames, NFS settings and
volume sizes live in `apps/variables.yaml`. This page describes repository design,
not evidence of a deployed or failure-tested service.

Traefik terminates TLS on `websecure`. Mautic trusts forwarded headers from the
configured pod CIDR through the JSON-valued `MAUTIC_TRUSTED_PROXIES` input, so it
recognizes the external HTTPS request while Apache listens internally on 8080.
The install hook also writes that input into `config/local.php`, which Mautic's
early proxy middleware reads before Symfony resolves environment parameters.
Web startup/readiness checks execute a local HTTP request to the pod address with
the public Host and forwarded HTTPS headers, checking for a 200 login response.
This follows the same trusted pod-network path as Traefik and avoids following an
HTTPS redirect to a pod that has no TLS listener.

## Components and placement

| Component | Placement | Data and client path |
| --- | --- | --- |
| Apache web | Two pods, required anti-affinity on left/right | Service and Traefik at `mautic.antblu.net`; processes run as UID/GID `1010:1010` on port 8080 |
| Queue workers | Two pods, required anti-affinity on left/right | Consume Mautic `email` and `hit` Messenger transports from MariaDB |
| Scheduled commands | Three staggered CronJobs | Segments at :00/:15/:30/:45, campaigns five minutes later, triggers ten minutes later; each job forbids overlap with itself |
| MariaDB | Two Galera data members on left/right | MariaDB operator, OpenEBS local data volumes, and operator-managed primary Service |
| Galera arbitrator | One `garbd` on tainted RTX | Third quorum vote; contains no database copy |
| Redis | Two data pods with Sentinel on left/right | Persistent local volumes, AOF every second, authenticated replication and election |
| Sentinel voter | One Sentinel-only pod on tainted RTX | Third Sentinel, quorum two; contains no Redis data copy |
| Redis routing | Two HAProxy pods on left/right | Authenticated role checks route PHP sessions to the current primary and close connections when a backend becomes unhealthy |
| Application files | RWX NFS at `10.30.0.5:/mnt/nvme/mautic` | Config, uploaded files/images and logs shared by all application processes |

The MariaDB layout copies Invoice Ninja: two operator-managed Galera members,
a separate `garbd` voter, local data PVCs and small Galera recovery PVCs. Mautic
connects to `mautic-db-primary`, rather than spreading writes over both members.
The operator controls primary selection and Service endpoints. Galera recovery
allows a minimum cluster size of one; loss of quorum or ambiguous data position
can still require operator recovery and must not be treated as permission to
bootstrap an arbitrary stale member.

The image guards and patches Mautic's installer lookup of the administrator role:
it selects the first administrator role rather than assuming primary key 1.
Galera's automatic ID spacing remains enabled, including its adjustment for the
arbitrator's membership. Image upgrades fail to build if that upstream lookup
changes and requires review.

Redis is used for shared PHP sessions with locking. Mautic's bundled Doctrine
Messenger transport stores queues in MariaDB; no Redis Messenger dependency is
added. Failed messages remain in the failed Doctrine transport for operator review.
The Redis image and database use their own supported Unix identities on local
volumes. UID/GID `1010:1010` applies to Mautic application processes and NFS files.

## Storage and installation

The Retain PV binds only to `mautic-data`; it does not create an export. NFS must
already allow UID/GID 1010 to create directories. A non-root init container creates
`config`, `files`, `images` and `logs` and seeds bundled media without replacing
existing files. It never changes ownership of the export. Per-pod cache and temporary
files are ephemeral; Apache logs go to container output. Protect NFS configuration
files because Mautic writes credentials and integration settings there.

Mautic pods deliberately omit `fsGroup`: the NFS CSI driver's recursive ownership
pass runs through kubelet's root identity, which cannot traverse private 1010-owned
directories on this export. A small root init container with only `CHOWN` prepares
the two fresh local `emptyDir` mount roots. It has no NFS mount. The media/config
init container and every Mautic process run as `1010:1010`; no recursive ownership
or permission changes are made to shared NFS data.

The service image extends the official Apache image, adds pinned phpredis and
remaps `www-data` to 1010 at build time. Its entrypoint starts Apache or CLI directly,
avoiding root-only startup helpers. The install/migration Sync hook runs after
Secrets, storage, database grants and Redis routing, before web/worker resources.
Repeated installation preserves an installed account; subsequent schema migrations
run in that one hook. Schema upgrades can still need a maintenance window because
old serving processes may remain present while a new migration runs.

## Availability limits

Web, worker, database and Redis placement separates the two ordinary workers.
Remaining Galera/Sentinel voters support a one-data-worker failover design; the
resulting degraded service has only one data copy until recovery. Redis replication
is asynchronous, so acknowledged session writes can be lost on promotion. In-flight
requests can fail, and a queue worker interruption can cause message redelivery;
application workflows must tolerate retries. Sentinel/HAProxy role checks are not
partition fencing and do not establish arbitrary-network-partition safety.

NFS, public routing, DNS, the Kubernetes API endpoint and operator actions remain
shared dependencies. CronJobs use scheduling/retry recovery rather than hot standby.
No failover timing, whole-Proxmox-host resilience or backup/restore guarantee is
established by these manifests. Replication is not an independent backup.

See [Mautic operations](/admin-guide/mautic/), the
[official Docker image](https://github.com/mautic/docker-mautic),
[Mautic configuration](https://docs.mautic.org/en/7.2/configuration/settings.html)
and [cron guidance](https://docs.mautic.org/en/7.2/configuration/cron_jobs.html).
