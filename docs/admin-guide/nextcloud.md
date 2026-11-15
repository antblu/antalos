---
title: "Nextcloud · Operate"
description: "Deploy Nextcloud and configure storage, sign-in, and companion services."
---

<nav class="guide-switcher" aria-label="Nextcloud guide sections"><a href="/user-guide/nextcloud/">Use</a><a href="/infrastructure/nextcloud/">Architecture</a><a aria-current="page" href="/admin-guide/nextcloud/">Operate</a></nav>

Use `apps/nextcloud/` with the [shared deployment workflow](/admin-guide/deploy-an-application/) to render manifests, prepare credentials, and reconcile the Application.

## 1. Prepare dependencies and inputs

1. Prepare CNPG, OpenEBS, NFS CSI, Garage, Traefik, cert-manager, and the identity service. Set the Nextcloud and companion hostname/storage variables.

2. Create the Garage bucket and permissions before first install; this is primary object storage, not an ordinary external-files mount. Prepare the app export for UID/GID 33.

3. Reseal the main, companion, Context Chat, and Talk credentials. Preserve the original instance ID, secret, password salt, and storage credentials when recovering data.

4. Follow the [Nextcloud deployment details](/admin-guide/nextcloud-integrations/) for app configuration and [upgrade procedure](/admin-guide/nextcloud-upgrades/) for an existing installation.

## 2. Reconcile the application

Nextcloud add-on archives are selected by the release versions in `apps/variables.yaml`, without repository-pinned SHA-512 checksums. The installer records each installed version in a `.APP_ID.gitops-version` file beside the app directory and skips that version on later runs. Existing checksum markers are replaced on the first installation with this scheme, which downloads the configured releases again.

Push the reviewed manifests and variables to the branch Argo CD tracks. Let the root app-of-apps discover the Application and run its hooks in order. Keep unresolved templates out of direct Kubernetes applies.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application nextcloud

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n nextcloud get pods,svc,pvc
```

Confirm the expected Git revision synced and the required workloads are ready. Wait for any initialization or migration Jobs to finish, then test the service.

## 3. Complete identity and first access

The repository installs `user_oidc`, but does not create its Authentik provider configuration for you. Add an OAuth2/OIDC provider in Authentik, bind the allowed group, and register the callback reported by the Nextcloud OIDC configuration. In Nextcloud administration, enter the client ID, client secret, discovery document, and stable user-ID mapping. Keep one working local administrator while verifying provisioning and existing-account linking. Do not assume that equal email addresses should merge accounts automatically.

## 4. Connect and operate the service

1. Finish the office JWT, Whiteboard, Context Chat, and Talk setup described in the integration guide; several values are reapplied by startup hooks.

2. Configure outbound mail, background-job scheduling, trusted domains/proxies, and allowed AI providers. Verify each feature with a non-admin account.

3. Upload, share, sync, and download a file; edit a document with two users; test a Talk call across networks. Establish a coordinated database/object backup before inviting users.

## Availability before maintenance

**Partially HA overall: replicated web and many companions, with shared storage, session, Redis recovery, and upgrade limits.**

Web, office, and Context Chat use zero-surge rolling updates. Redis HAProxy also uses zero surge and one unavailable, so replacements do not require a third anti-affined placement. Major Nextcloud upgrades still require the documented isolated maintenance and single-owner schema migration procedure.

Establish Redis election and safe rejoin behavior, protect shared storage, and exercise file/office/Talk workflows during degraded operation. A warm web replica does not make the whole Nextcloud suite outage-free.

Review [failure behavior](/infrastructure/nextcloud/#availability-and-failure-behavior) before maintenance. If the service uses replication or quorum, confirm data has resynchronized and voting capacity has recovered.

## 5. Maintain and recover

A recoverable Nextcloud installation needs the database, Garage objects, original secret/salt and credentials, Git configuration, and any NFS content that cannot be re-created. Pinned application code can be downloaded again, but Whiteboard recording files or manually installed extensions on shared storage need separate consideration. Redis locks and disposable pod files do not replace the data backup.

Read the target version’s release notes and record a recovery point before upgrading. If the release migrates a database schema, plan how to restore the database before rolling back the image. See [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/).

## Troubleshooting

For a 503 or incomplete rollout, separate database migration, app-code initialization, Redis discovery, and ingress failures. For missing files, verify database and object-store consistency before changing buckets. Read-only configuration requires the controlled maintenance procedure in the upgrade guide.

If `/status.php` succeeds but `/login` intermittently returns 500, inspect both `nextcloud-redis-haproxy` endpoints and Nextcloud Redis errors. A HAProxy pod can accept TCP connections while its `redis-primary` backend has no available server. The HAProxy health endpoint on port 8404 reports 503 in that state, so Kubernetes removes it from the Service. Liveness checks the proxy listener independently; an unavailable Redis primary must not trigger repeated proxy restarts. DNS resolvers refresh data-pod addresses after replacement. Confirm the login path after both proxies become ready.

### Redis restart recovery

Redis starts from a writable `redis.conf` on its existing data PVC. Sentinel can therefore persist promotion and rejoin changes with `CONFIG REWRITE`. Data-side Sentinel configuration also lives on that PVC; the third voter uses an `emptyDir` and a stable identity. All three voters announce stable DNS names. Do not replace those files with ordinal-based defaults at each start.

When adopting this configuration, first establish one healthy writer and a synchronized replica; the initial configuration seeds ordinal 0 as primary. If neither instance is primary, compare replication IDs and offsets before selecting a recovery candidate. Never promote both. Inspect `INFO replication`, `SENTINEL MASTER nextcloud`, and `SENTINEL CKQUORUM nextcloud` on every voter. Stale Sentinel identities can prevent a majority even when two live voters communicate; reset stale topology only after identifying the correct writer. Wait for replica synchronization and test the login and Whiteboard paths separately from Argo health.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/app.yaml)
- [`availability.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/availability.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/certificate.yaml)
- [`companion-secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/companion-secrets.yaml)
- [`companion-services.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/companion-services.yaml)
- [`config.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/config.yaml)
- [`context-chat-backend.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/context-chat-backend.yaml)
- [`context-chat-secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/context-chat-secrets.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/database.yaml)
- [`metrics.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/metrics.yaml)
- [`redis.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/redis.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/secrets.yaml)
- [`security-headers.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/security-headers.yaml)
- [`storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/storage.yaml)
- [`talk-secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/talk-secrets.yaml)
- [`talk.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/talk.yaml)
- [`well-known.yaml`](https://github.com/antblu/antalos/blob/main/apps/nextcloud/well-known.yaml)

[Official Nextcloud documentation](https://docs.nextcloud.com/server/latest/user_manual/en/).
