---
title: Obsidian LiveSync · Architecture
description: Understand Authentik proxy authentication and two independently replicated CouchDB servers.
---

<nav class="guide-switcher" aria-label="Obsidian LiveSync guides"><a href="/user-guide/obsidian/">Use</a><a aria-current="page" href="/infrastructure/obsidian/">Architecture</a><a href="/admin-guide/obsidian/">Operate</a></nav>

The backend consists of two independent single-node CouchDB servers, two HAProxy replicas, and a Job that configures continuous replication in both directions for the selected database. It is not a two-member CouchDB cluster.

## Request and identity path

Requests reach Traefik at `OBSIDIAN_HOST`. The `/outpost.goauthentik.io/` route reaches Authentik's embedded outpost; other requests use the Authentik forward-auth middleware before HAProxy.

HAProxy removes incoming CouchDB identity headers, maps the Authentik username into CouchDB proxy-auth headers, and signs it with the shared proxy secret. CouchDB verifies that token. The current mapping assigns the `_admin` role to accepted identities, so the Authentik application access policy is an administrative database-access boundary.

The proxy has a namespace-based ingress NetworkPolicy. The policy only provides isolation if the cluster networking actually enforces NetworkPolicy; the manifest alone does not establish enforcement.

## Data and routing

| Component | Configuration | Meaning |
| --- | --- | --- |
| CouchDB | 2 StatefulSet replicas with required host anti-affinity | Independent data directories on separate LocalPV claims |
| Database mode | `single_node = true`, `n = 1`, `q = 1` | Each process manages its own database |
| HAProxy | 2 anti-affined replicas | Primary server 0, backup server 1; TCP reachability checks |
| Replication Job | Creates the named database and persistent replication documents | Continuous copying in both directions for `OBSIDIAN_DATABASE_NAME` |
| Local storage | One `openebs-local` claim per CouchDB pod | Disk persistence remains tied to the owning worker |

The Job creates `_users` on each server but its two replication documents target the selected vault database. Do not assume that users, every additional database, or all server settings are also replicated.

## Availability and failure behavior

**Partial availability through a backup backend and asynchronous database replication.** If server 0 stops accepting connections, HAProxy can use server 1. A TCP check does not measure replication lag, database permissions, or correct document contents.

Changes may not have reached the other server when a failure occurs. When server 0 returns, its preferred routing role can resume before application data has fully converged. Compare replication status and document state during recovery; handle conflicts through the supported application procedure.

CouchDB's replication mechanism copies changes in one direction per replication task; this configuration creates both directions. It also propagates deletions. See the [official replication documentation](https://docs.couchdb.org/en/stable/replication/intro.html). This is not an independent historical backup.

## Source and recovery contract

`apps/obsidian/` owns `couchdb.yaml`, `proxy.yaml`, `config.yaml`, `replication.yaml`, the certificate, and sealed credential resources. Preserve database backups, original credential/signing material, and vault encryption material. Keep the raw proxy secret and its encoded representation consistent across CouchDB and HAProxy.

See [administration](/admin-guide/obsidian/) for deployment and native-client authentication considerations.
