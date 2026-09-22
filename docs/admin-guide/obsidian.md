---
title: Obsidian LiveSync · Operate
description: Deploy the CouchDB sync backend, configure the access boundary, and recover replication without resetting vaults.
---

<nav class="guide-switcher" aria-label="Obsidian LiveSync guides"><a href="/user-guide/obsidian/">Use</a><a href="/infrastructure/obsidian/">Architecture</a><a aria-current="page" href="/admin-guide/obsidian/">Operate</a></nav>

Read the [LiveSync setup documentation](https://github.com/vrtmrz/obsidian-livesync/blob/main/docs/setup_own_server.md) and [CouchDB replication guide](https://docs.couchdb.org/en/stable/replication/intro.html) alongside the [Antalos architecture](/infrastructure/obsidian/). This installation adds Authentik and HAProxy to the normal database connection path.

## Prepare the inputs

| Input | Where it is consumed |
| --- | --- |
| `OBSIDIAN_HOST` | TLS certificate and Traefik route |
| `OBSIDIAN_DATABASE_NAME` | Replication Job's database creation and replication documents |
| `OBSIDIAN_DATABASE_STORAGE_SIZE` | One LocalPV claim for each database server |
| `obsidian-couchdb-admin` | CouchDB administrator and replication Job credentials |
| `obsidian-couchdb-auth` | CouchDB proxy secret and HAProxy's matching encoded secret |
| Authentik application/provider | External access policy and outpost authorization |

Generate and seal credentials in `apps/obsidian/`. The CouchDB and HAProxy secret representations must describe the same signing key. Keep existing keys and database contents when restoring an installation.

## Deploy the backend

1. Prepare OpenEBS capacity, the certificate issuer, Traefik, and Authentik.
2. Configure an Authentik provider/application for this hostname and assign only the intended trusted identities. The current proxy maps accepted identities to CouchDB `_admin`.
3. Reconcile `apps/obsidian/app.yaml` through the [application workflow](/admin-guide/deploy-an-application/).
4. Confirm both CouchDB members initialize and the replication Job configures both directions. A completed Job does not establish that ongoing replication is current.
5. Complete browser access and native-client access separately. A client must receive database responses using its supported authentication method, not an HTML sign-in page.
6. Provision a small test vault and confirm a note synchronizes between two devices before using an existing vault.

## Native-client authentication needs an explicit decision

The checked-in route protects all database requests through Authentik. Do not assume that entering the database administrator password into LiveSync bypasses that middleware. Choose and configure the Authentik-supported client access method for the intended devices, then follow the matching plugin setup procedure.

Do not broaden the Authentik policy merely to make a failed connection disappear. Its accepted identities currently receive full database administration rights. A multi-user least-privilege vault design requires a deliberate role/database policy change beyond this documentation.

## Replication and recovery

Inspect both database members, replication scheduler state, and the specific vault database. The Job only creates each named replication document when it is missing; changing credentials or a database name in configuration does not automatically rewrite an existing replication document.

Restore data before reconnecting clients to an empty replacement. Retain local vault backups and encryption material. After a failed member returns, resolve replication lag and conflicts before calling redundancy restored. Follow CouchDB's [replication status guidance](https://docs.couchdb.org/en/stable/replication/intro.html) for the supported APIs.

A desired-state difference involving immutable StatefulSet fields is not a reason to delete healthy database claims. Use the exact field difference to plan a data-preserving migration. A TTL-cleaned replication Job may also be recreated by Argo self-heal because it is an ordinary managed Job in this source.
