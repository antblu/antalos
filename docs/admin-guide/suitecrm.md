---
title: "SuiteCRM \u00b7 Deployment and Admin Guide"
description: "Deploy SuiteCRM with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="SuiteCRM guide sections"><a href="/user-guide/suitecrm/">Overview and User Guide</a><a href="/infrastructure/suitecrm/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/suitecrm/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/suitecrm/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Deploy MariaDB CRDs, the MariaDB operator, OpenEBS, NFS CSI, ingress, and cert-manager first. Set `SUITECRM_*` variables.

2. Prepare the NFS export for the web image’s runtime identity. Preserve the predeclared Galera PVCs and node placement in `storage.yaml`.

3. Reseal database, application, S3, SAML, and registry credentials. Build/publish the custom image in `apps/suitecrm/image/` when changing the packaged release or configuration.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application suitecrm

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n suitecrm get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

SuiteCRM is configured for SAML, not OIDC. Create an Authentik SAML provider for the SuiteCRM origin and use SuiteCRM’s service-provider metadata to obtain its ACS URL and bindings. Match `SAML_SP_ENTITY_ID`, the Authentik metadata/SSO URLs, and the username mapping `http://schemas.goauthentik.io/2021/02/saml/username`. Seal the IdP certificate, SP certificate, and SP private key in `suitecrm-saml`. Assertions must be signed under the checked-in settings. New-account creation is enabled; constrain provider access and assign CRM roles after provisioning.

The `suitecrm-saml-provisioning` ConfigMap supplies a backend extension installed by the bootstrap Job. SuiteCRM 8.10.2's legacy user-save permission check rejects new users without an administrator actor, including users being provisioned after successful SAML validation. The extension uses the existing active system administrator only during account creation and restores the previous actor in a `finally` block. Provisioned users remain active, non-admin, external-authentication-only accounts. The bootstrap also restores the upstream `external_auth_only` default on existing shared application copies. Restart the web replicas after updating this extension so each replica rebuilds its local Symfony container cache.

The extension directs unauthenticated visitors to the native password form at `/auth`, which also offers **Sign in with SSO** linking to `/saml/login`. Keep `AUTH_TYPE=saml`: SuiteCRM supplies the native password firewall alongside SAML, sharing the authenticated session. Local accounts retain password login and its existing throttling and two-factor checks. SSO-provisioned accounts have no local password; enabling password access for one requires an administrator to clear its external-only setting and set a password. The bootstrap explicitly registers Smarty's `file_exists` modifier used by the legacy header, preventing its unregistered-function deprecation without hiding warnings.

## 4. Connect and operate the service

1. Let `suitecrm-bootstrap` finish before using the application. Log in as both administrator and ordinary user and confirm record visibility.

2. Configure outbound email and any inbound mailbox processing. Confirm scheduled jobs and the messenger worker process queued work.

3. Inspect the daily physical backup status and rehearse database plus NFS restoration together.

## Availability before maintenance

**Partially HA: replicated web and Galera data, but background workers and shared files have separate outage paths.**

Web updates use zero surge and one unavailable. MariaDB declares ReplicasFirstPrimaryLast. The messenger is singleton and can pause during its update. A PDB protects evictions, not every scheduled task or a database schema migration.

Protect NFS, define background-job outage expectations, and prove a database-plus-files restore. For stronger complete-service HA, assess supported messenger concurrency and capture CRM read/write behavior during membership loss and rejoin.

Use the [component-by-component failure contract](/infrastructure/suitecrm/#availability-and-failure-behavior) before a node drain, database promotion, or upgrade. Restoring a healthy replica count must include data resynchronization and restored voting capacity, not just Running pods.

## 5. Maintain and recover

Back up MariaDB and the NFS application data together, including uploaded files and custom configuration. Preserve the SAML service-provider key and identity-provider certificate. The `PhysicalBackup` resource covers the database; it does not itself back up NFS.

Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## 6. Upgrade SuiteCRM

This deployment cannot be upgraded safely by changing `SUITECRM_IMAGE_TAG` alone. The container image supplies the target release, but `/var/www/html` is the shared `suitecrm-data` NFS volume. SuiteCRM must upgrade that shared file tree and its database exactly once before the new image is rolled out to every workload.

SuiteCRM's [official upgrade guide](https://docs.suitecrm.com/8.x/admin/upgrading/) is authoritative for supported version steps. Read the [target release notes](https://docs.suitecrm.com/8.x/admin/releases/) and [compatibility matrix](https://docs.suitecrm.com/8.x/admin/compatibility-matrix/) before changing production. Do not skip a required intermediate release. The procedure below adapts the official `suitecrm:app:upgrade` and `suitecrm:app:upgrade-finalize` process to this repository's shared-NFS and GitOps layout.

### 6.1. Prepare and test the target

1. Rehearse the entire upgrade against a recent database and NFS copy in an isolated environment. Include the checked-in SAML provisioning extension and any files under `public/legacy/custom`.

2. Confirm that the target supports the pinned PHP, MariaDB, and web-server versions. Review every release note between the current and target versions for required actions.

3. Download the official `SuiteCRM-<version>.zip`, calculate its SHA-256 digest, and compare the download with a trusted upstream checksum when one is published. Do not copy a checksum from an untrusted mirror.

4. Build `apps/suitecrm/image/` with the target version, `SUITECRM_PHP_BASE_IMAGE`, and verified release checksum. Publish the immutable image and record its registry digest. Do not change `apps/variables.yaml` or let Argo CD deploy the target yet.

The four SuiteCRM release variables have different roles:

| Variable | Purpose |
| --- | --- |
| `SUITECRM_IMAGE_TAG` | SuiteCRM target version and image tag |
| `SUITECRM_IMAGE_DIGEST` | Immutable digest of the published custom image |
| `SUITECRM_PHP_BASE_IMAGE` | Pinned PHP/Apache base image, including its digest |
| `SUITECRM_RELEASE_SHA256` | SHA-256 of the official SuiteCRM release ZIP used by the image build and upgrade |

### 6.2. Establish a maintenance window

Record the current Git revision, image digest, SuiteCRM version, Argo CD state, Galera state, and all workload replica counts. Confirm that both web replicas, the messenger worker, recent scheduler Jobs, and the current database backup are healthy before proceeding.

Block public writes before touching the shared application tree. Keep one current web pod as the sole upgrade executor, but isolate ingress from users and integrations. Stop the other web replica, the messenger Deployment, and the scheduler CronJob through a reviewed temporary maintenance change. Argo CD must not self-heal those temporary replica changes while the maintenance window is active. Record the temporary change and its exact reversal; never leave `argocd.argoproj.io/skip-reconcile` behind after maintenance.

The database, NFS volume, and administrator exec access must remain available. Do not run the upgrade command from both web replicas.

### 6.3. Take a coordinated recovery point

After writes and background processing are stopped:

1. Trigger a new SuiteCRM `PhysicalBackup` and wait for its `Complete` condition to report success. Verify that the new object exists in the configured Garage bucket; an old successful Job or a scheduled timestamp is not proof of a current backup.

2. Snapshot or copy the complete `suitecrm-data` NFS tree, including application files, uploads, extensions, configuration, and version-marker files.

3. Preserve the sealed application, database, S3, registry, and SAML secrets with the matching Git revision.

Treat the database and NFS copies as one recovery point. If the schema migration fails after making changes, restore both copies from that point. Starting the old image against a partly upgraded schema is not a rollback.

### 6.4. Run the upgrade once

Select the single current web pod retained as the executor. Replace both placeholders with the reviewed target version and release checksum:

```bash title="Stage and verify the official target package"
SUITECRM_UPGRADE_POD='REPLACE_WITH_THE_SINGLE_EXECUTOR_POD'
SUITECRM_TARGET='REPLACE_WITH_TARGET_VERSION'
SUITECRM_TARGET_SHA256='REPLACE_WITH_VERIFIED_RELEASE_SHA256'

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n suitecrm exec "$SUITECRM_UPGRADE_POD" -c suitecrm -- sh -ec '
    target="$1"
    expected="$2"
    package="/var/www/html/tmp/package/upgrade/SuiteCRM-${target}.zip"

    mkdir -p /var/www/html/tmp/package/upgrade
    curl -fL --retry 3 \
      -o "$package" \
      "https://github.com/SuiteCRM/SuiteCRM-Core/releases/download/v${target}/SuiteCRM-${target}.zip"
    printf "%s  %s\n" "$expected" "$package" | sha256sum -c -
  ' sh "$SUITECRM_TARGET" "$SUITECRM_TARGET_SHA256"
```

Stop if verification fails. With traffic still isolated, run the official upgrade and finalize commands from that same pod:

```bash title="Upgrade the shared files and database once"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n suitecrm exec "$SUITECRM_UPGRADE_POD" -c suitecrm -- sh -ec '
    target="$1"
    cd /var/www/html
    php -d session.save_path=/var/www/html/var/sessions \
      bin/console suitecrm:app:upgrade -t "SuiteCRM-${target}" -vvv
    php -d session.save_path=/var/www/html/var/sessions \
      bin/console suitecrm:app:upgrade-finalize -t "SuiteCRM-${target}" -vvv
    touch ".suitecrm-code-${target}"
  ' sh "$SUITECRM_TARGET"
```

Both commands must finish successfully before continuing. The version marker tells `suitecrm-bootstrap` that the shared NFS tree already contains the migrated target; without it, the hook would merge the image's files into the live tree again. Review the SAML extension against the target source when the bootstrap registration guard reports an incompatibility.

### 6.5. Publish the target and reconcile

Update `SUITECRM_IMAGE_TAG`, `SUITECRM_IMAGE_DIGEST`, `SUITECRM_PHP_BASE_IMAGE` when changed, and `SUITECRM_RELEASE_SHA256` in `apps/variables.yaml`. Publish the reviewed Git change to the revision tracked by Argo CD.

Allow Argo CD to run `suitecrm-bootstrap` and roll the target image. The bootstrap hook reinstalls the repository-owned SAML extension, sets up messenger transports, and clears a pod-local cache. Restore the declared two web replicas, messenger replica, scheduler schedule, and normal ingress only after the hook and rollout succeed. Remove every temporary maintenance or reconciliation pause.

### 6.6. Validate before reopening service

Do not accept the upgrade based only on Running pods. Confirm all of the following:

1. Argo CD reports the intended Git revision as `Synced` and `Healthy`, and no operation or hook remains active.
2. `suitecrm-bootstrap` completed, both web replicas use the target image digest with zero new restarts, Galera is Primary/Ready, and the messenger and newest scheduler Job complete normally.
3. HTTPS certificate validation succeeds, `/` redirects to `/auth`, and `/auth` renders the SuiteCRM login application.
4. A local administrator and an ordinary Authentik SAML user can log in, remain logged in while requests cross the ingress, view permitted records, and create then edit a disposable record. Test logout as well.
5. Outbound mail, queued work, and any inbound-mail integration still function.
6. For SuiteCRM 8.10.0 and later, **Admin → Migrations** has no unexplained pending or failed manual migration. Keep the messenger running while approved manual migration tasks execute.
7. A new post-upgrade database backup completes and the matching object is present in Garage.

Keep the pre-upgrade recovery point until the application, integrations, background migrations, and backups are accepted. If a schema-changing upgrade must be rolled back, restore the coordinated database and NFS recovery point before restoring the previous Git revision and image.

## Troubleshooting

For database startup failures, inspect Galera quorum, PVC placement, and arbitrator compatibility. NFS permission errors need export-side ownership analysis; recursively changing ownership on populated shared storage can be disruptive. SAML failures require checking assertion signatures, entity IDs, and username mapping.

If navigation logs users out and `logs/prod/prod.log` reports `Failed to decode session object`, verify that each web pod has its own local `/var/www/html/var/sessions` emptyDir and that the ingress is setting its sticky cookie. PHP sessions are mutable, lock-heavy state and must not be shared over the application NFS volume. Recreate both web pods after changing this mount; existing pods retain their old volume layout. A healthy Argo CD status does not establish that existing pods have adopted the new session mount.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/app.yaml)
- [`backup.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/backup.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/database.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/secrets.yaml)
- [`storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/storage.yaml)
- [`suitecrm.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/suitecrm.yaml)

[Official SuiteCRM documentation](https://docs.suitecrm.com/user/).
