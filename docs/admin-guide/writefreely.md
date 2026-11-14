---
title: WriteFreely
description: Operate the replicated WriteFreely blog and its Galera database.
---

WriteFreely publishes the single-author blog at the HTTPS hostname set by `WRITEFREELY_HOST` in `apps/variables.yaml`. Traefik terminates TLS with a certificate from `letsencrypt-prod`. DNS must point the hostname to the public ingress. Self-registration and federation are disabled.

The deployment explicitly selects WriteFreely's bundled `write` theme for the homepage and login page. Keep `theme = write` in the application configuration to serve `/css/write.css`. When changing `config.ini` in the ConfigMap, increment the web Deployment's `antalos.net/config-revision` annotation so the init container can regenerate the runtime configuration on both pods.

## First sign-in

Open `/login` and sign in as `antblu`. The installation Job reads the initial password from the `admin-password` key of the `writefreely-credentials` Secret in the `writefreely` namespace. Retrieve it through your private cluster administration session and store it in your password manager. After changing the password in WriteFreely, the live password is stored as a hash in MariaDB.

## Sign in with antID

1. Wait for Authentik to import the WriteFreely blueprint. Sign-in is restricted to `writefreely-admins`. Members of `antalos-admins` inherit access through the worker's startup reconciliation.
2. Sign in to your existing WriteFreely account with its local password. Open `/me/settings` and choose **Link antID** under **Link External Accounts**. Complete sign-in with the Authentik identity you want to link.
3. Sign out of WriteFreely, then choose **Sign in with antID** at `/login`. Keep the local password for recovery.

WriteFreely uses the Authentik UserInfo subject to look up the linked account. Keep the client ID and subject mapping stable to preserve that link. The provider allows the exact callback `https://<WRITEFREELY_HOST>/oauth/callback/generic` and requests only the `openid` scope. Authentik must be reachable from browsers and WriteFreely pods over HTTPS.

To rotate the client secret or move to a different cluster, seal the same new secret for `authentik-writefreely-oidc` in `authentik` and `writefreely-oidc` in `writefreely`, using the `client-secret` key in both. Update both SealedSecrets and increment `WRITEFREELY_OIDC_REVISION` to roll the pods and reapply the blueprint. AntID sign-in can briefly fail while the two applications converge on the new secret.

## Availability and recovery

Two web pods run on separate general workers. They use the same cookie, CSRF, and email encryption keys from Sealed Secrets. A rolling update replaces one pod at a time, and a PodDisruptionBudget keeps one pod available for voluntary disruptions. Traefik routes to ready endpoints.

The MariaDB operator runs two Galera data members on separate general workers with node-local OpenEBS volumes. An arbitrator on the quorum worker provides the third vote. WriteFreely connects through the operator's primary Service. A data-member loss can interrupt requests while the operator updates the writer endpoint. Loss of quorum, ingress, or shared network paths can take the blog offline.

Keep MariaDB backups and the original sealed application keys together for recovery. The manifests provision replicated database volumes. Backup scheduling and restore testing are separate operator tasks.

## Upgrades

Check the upstream release notes for schema changes. The retained bootstrap Job initializes a new database and its first administrator. For a release requiring a migration, back up MariaDB, follow the upstream maintenance procedure, and version the bootstrap Job and the matching Application ignore rule before reconciling the new web image.

- [WriteFreely configuration](https://writefreely.org/docs/latest/admin/config)
- [WriteFreely releases](https://github.com/writefreely/writefreely/releases)
