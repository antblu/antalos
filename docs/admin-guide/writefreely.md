---
title: WriteFreely
description: Operate the replicated WriteFreely blog and its Galera database.
---

WriteFreely publishes the single-author blog at the HTTPS hostname set by `WRITEFREELY_HOST` in `apps/variables.yaml`. Traefik terminates TLS with a certificate from `letsencrypt-prod`. DNS must point the hostname to the public ingress. Self-registration and federation are disabled.

## First sign-in

Open `/login` and sign in as `antblu`. The installation Job reads the initial password from the `admin-password` key of the `writefreely-credentials` Secret in the `writefreely` namespace. Retrieve it through your private cluster administration session and store it in your password manager. After changing the password in WriteFreely, the live password is stored as a hash in MariaDB.

## Availability and recovery

Two web pods run on separate general workers. They use the same cookie, CSRF, and email encryption keys from Sealed Secrets. A rolling update replaces one pod at a time, and a PodDisruptionBudget keeps one pod available for voluntary disruptions. Traefik routes to ready endpoints.

The MariaDB operator runs two Galera data members on separate general workers with node-local OpenEBS volumes. An arbitrator on the quorum worker provides the third vote. WriteFreely connects through the operator's primary Service. A data-member loss can interrupt requests while the operator updates the writer endpoint. Loss of quorum, ingress, or shared network paths can take the blog offline.

Keep MariaDB backups and the original sealed application keys together for recovery. The manifests provision replicated database volumes. Backup scheduling and restore testing are separate operator tasks.

## Upgrades

Check the upstream release notes for schema changes. The retained bootstrap Job initializes a new database and its first administrator. For a release requiring a migration, back up MariaDB, follow the upstream maintenance procedure, and version the bootstrap Job and the matching Application ignore rule before reconciling the new web image.

- [WriteFreely configuration](https://writefreely.org/docs/latest/admin/config)
- [WriteFreely releases](https://github.com/writefreely/writefreely/releases)
