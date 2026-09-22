---
title: Storage and application state
description: Distinguish local volumes, replicated databases, shared NFS, object storage, and restore-based SQLite services.
---

A persistent volume tells Kubernetes where to keep data. It does not automatically create another copy or a backup. antalos combines application replication with external file and object services, and each has a different recovery path.

## Storage choices in this repository

| Storage | Typical contents | How redundancy or recovery works |
| --- | --- | --- |
| OpenEBS LocalPV | PostgreSQL, Redis, search, metrics, CouchDB, and repository data | Each volume belongs to a node. A second data copy comes from the application |
| External NFS | Shared application files, media, backup exports, and SQLite replicas | Multiple pods may mount the same server; server availability is external |
| Garage S3 | User objects, attachments, artifacts, and selected backups | Applications address configured buckets; Garage server management is external |
| Pod-local SQLite + Litestream | Headscale, Headplane, RustDesk rendezvous, CrowdSec LAPI, and Uptime Kuma state | One active database, copied to a backup location and restored on replacement |
| Debian VM disks and mounts | Models, media, Docker state, and companion output | Managed and backed up separately from Kubernetes PVCs |

## Local does not mean replicated

`openebs-local` provisions local storage. Mayastor replication is not enabled by the OpenEBS application. A lost node cannot simply attach that node's LocalPV to another worker.

A two-instance PostgreSQL cluster protects data through database replication and promotion. Redis data members use Redis replication; Sentinel voters decide roles. Obsidian's independent CouchDB servers use continuous database replication. Those mechanisms have different consistency and recovery behavior even though all can use local volumes.

Read the [availability guide](/infrastructure/availability/) before treating a second process as a second complete dataset. Elasticsearch replica allocation and VictoriaLogs sharding deserve particular attention.

## Shared external storage

The NFS CSI driver mounts exports; it does not create or manage the NAS. Garage bucket references and credentials do not provision an object-storage cluster. The application variables declare the endpoints and paths consumed by Kubernetes.

| Before deploying a consumer | Prepare |
| --- | --- |
| NFS-backed service | Export path, permissions, UID/GID expectations, client reachability, and backup policy |
| Garage-backed service | Bucket, access policy, endpoint/region compatibility, credentials, and recovery policy |
| Local database cluster | Eligible workers, local disk capacity, independent replicas, and database backups |
| Litestream-backed singleton | Writable backup export, compatible database restore, and the associated identity/encryption material |

Several services share the declared external storage endpoint. Losing it can interrupt unrelated applications simultaneously. Storage-server replication, snapshots, or failover need evidence from the NAS/Garage deployment; this repository's client manifests do not establish them.

## Recover a complete application

An application can need several matching pieces. For Nextcloud, the database describes objects held in Garage. For a vault, encrypted data must retain the original keys and account material. For SQLite services, a fresh empty database can start successfully while containing none of the former configuration.

Record these items for each service:

1. The authoritative database and its recovery point.
2. Files or objects referenced by that database.
3. Original credentials, encryption keys, signing keys, and sealing identity.
4. The configuration revision and compatible application version.
5. A user action that confirms the restored state is useful.

Replication can propagate a deletion. A backup is a separately recoverable history, with restore procedures and retained credentials. Use [disaster recovery](/admin-guide/disaster-recovery/) for the recovery sequence and each service's architecture guide for its data boundary.
