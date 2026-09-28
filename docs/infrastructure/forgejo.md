---
title: Forgejo · Architecture
description: Git repository storage, CNPG, Redis Sentinel, and Garage dependencies.
---

<nav class="guide-switcher" aria-label="Forgejo guides"><a href="/user-guide/forgejo/">Use</a><a aria-current="page" href="/infrastructure/forgejo/">Architecture</a><a href="/admin-guide/forgejo/">Operate</a></nav>

`apps/forgejo/` declares two Forgejo application pods using UID/GID 1009 on separate main workers, two CNPG PostgreSQL instances on those workers, two Redis data pods with Sentinel sidecars, and one additional Sentinel voter on the tainted RTX worker. The Redis voters elect a data primary; the RTX pod holds no Redis data. PostgreSQL uses a preferred synchronous standby, permitting degraded writes when one database pod is unavailable. A PodDisruptionBudget keeps one application pod available during voluntary disruption.

The application mounts `10.30.0.5:/mnt/nvme/git_repos` over NFS 4.1 for repositories and its persistent configuration and SSH keys. The path is owned by `1009:1009`. A static PV retains the external export if the claim is removed. Forgejo stores its other object data in the existing Garage `gitlabs` bucket under a `forgejo` base path. Object storage is separate from the Git repository tree.

## Availability and recovery

Forgejo has two serving pods and redundant database and Redis members. A single main worker failure should leave one application pod and a database writer after promotion, provided Redis quorum, NFS, Garage, DNS, and ingress remain reachable. Promotion and reconnects may interrupt requests. The NFS export and Garage endpoint are shared dependencies, so the overall service has not been proven tolerant of every single-node or external-service failure. NFS and S3 are not backups; recovery needs a consistent PostgreSQL backup, repository tree, Garage objects, and the original encryption and SSH keys. Fence a failed worker before allowing a replacement to write the same NFS tree.

The HTTPS endpoint uses Traefik and a `letsencrypt-prod` certificate. Git SSH uses a LoadBalancer Service on the shared `10.30.0.200` address, port 22. External DNS and routing must point to those endpoints. The [operations guide](/admin-guide/forgejo/) describes the deployment checks.
