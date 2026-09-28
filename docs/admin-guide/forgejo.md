---
title: Forgejo · Operate
description: Deploy and recover Forgejo with its database, Redis quorum, NFS repositories, and Garage objects.
---

<nav class="guide-switcher" aria-label="Forgejo guides"><a href="/user-guide/forgejo/">Use</a><a href="/infrastructure/forgejo/">Architecture</a><a aria-current="page" href="/admin-guide/forgejo/">Operate</a></nav>

## Deploy

1. Verify that `10.30.0.5:/mnt/nvme/git_repos` is exported over NFS 4.1 and writable by UID/GID `1009:1009`. Back up the tree, including Forgejo configuration and SSH keys. The PV does not create the export.
2. Keep the `forgejo-s3` SealedSecret scoped to the Forgejo namespace and grant its key access to the existing `gitlabs` bucket. Forgejo uses a dedicated `forgejo` prefix. Keep the generated `forgejo-app` keys when restoring data. The database and Redis credentials are also SealedSecrets.
3. Publish `apps/forgejo/` and its values in `apps/variables.yaml` to the branch tracked by Argo CD. The root Application discovers `app.yaml`. Verify that the Certificate is Ready, the PVC is Bound, the two PostgreSQL pods and three Sentinel voters are healthy, and Forgejo is Ready.
4. Point `git.antblu.net` HTTPS and SSH traffic to the shared `10.30.0.200` address. Check the external web login, create and clone a small repository, push over SSH, and upload and download an attachment to prove Garage object storage. A Ready pod alone does not verify these paths.

Public registration is disabled. The PostSync Job bootstraps the `forgejo-admin` account once with `forgejo admin user create` after the application has completed migrations, using the `forgejo-admin` Secret for its password and email. Forgejo reserves the literal username `admin`. Keep that Secret protected. Rotate or remove the bootstrap password after a separate administrator identity is established.

The service uses two application pods on separate workers. During a rolling update, one may be unavailable while the other serves requests. Before replacing a pod from a partitioned worker, confirm that the old process is stopped or fenced. Backup and restore PostgreSQL, the NFS tree, the Garage prefix, and the application keys as one recovery set. See the [architecture guide](/infrastructure/forgejo/) and [Forgejo administration documentation](https://forgejo.org/docs/latest/admin/).
