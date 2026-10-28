---
title: "Upgrade Nextcloud safely"
description: "A repeatable migration procedure for antalos read-only configuration, pod-local runtime, and shared data."
---

This deployment generates read-only configuration and uses disposable per-pod runtime files. Upgrading requires a coordinated maintenance window and one database migration owner; changing an image tag alone is insufficient.

App-only updates can also trigger the “Update needed” page even when the server image and internal version match. Complete the same maintenance, backup, single-owner `occ upgrade`, and verification procedure for those updates. Check every app’s declared Nextcloud compatibility before changing its pin; the latest app release may target a newer server major.

## 1. Select a supported upgrade path

Read the release notes and app compatibility for the current and target versions. Upgrade to the current major release’s latest supported maintenance release before advancing to the next major, never skip a major release, and finish pending background migrations before advancing again. Use the [official upgrade guide](https://docs.nextcloud.com/server/latest/admin_manual/maintenance/upgrade.html) with documentation matching the deployed release.

Keep these variables distinct:

| Variable | Meaning |
| --- | --- |
| `NEXTCLOUD_IMAGE_TAG` | Container image tag, including its flavor suffix |
| `NEXTCLOUD_SERVER_VERSION` | Full internal server version used by the generated configuration |
| `NEXTCLOUD_CONFIG_REVISION` | Revision used to roll configuration changes into pods |

The public release and internal version can differ. Inspect the target image’s `version.php` in a disposable environment before publishing the version change; do not infer the internal value by adding a suffix.

### Nextcloud 35 target

The repository targets `nextcloud:35.0.2-apache`, with internal server version `35.0.2.2` from upstream [`version.php`](https://github.com/nextcloud/server/blob/v35.0.2/version.php). Confirm that value in the actual target image before rollout. This is desired configuration, not evidence of a completed live migration.

The [Nextcloud 35 upgrade notes](https://docs.nextcloud.com/server/stable/admin_manual/release_notes/upgrade_to_35.html) remove PHP 8.2 support and raise the Debian minimum to 13, Ubuntu to 24.04, and SLES 15 to SP7. The [official Apache image recipe](https://github.com/nextcloud/docker/blob/master/35/apache/Dockerfile) uses PHP 8.5 on Debian 13 (Trixie); the container runtime determines these requirements, independently of the Kubernetes host OS. PostgreSQL 18, already selected here, is supported by the [Nextcloud 35 system requirements](https://docs.nextcloud.com/server/stable/admin_manual/installation/system_requirements.html). The MariaDB 10.11 and MySQL 8.4 minimums, and the MySQL 9+ MD5 component instruction, do not apply to this PostgreSQL deployment.

The app pins advance Assistant to 4.1.0, Deck to 1.19.1, External sites to 10.0.0, Group folders to 23.0.1, OpenAI integration to 5.0.0, Talk to 25.0.6, and Whiteboard to 2.1.2, whose releases declare Nextcloud 35 compatibility in the [app-store metadata](https://apps.nextcloud.com/api/v1/platform/35.0.2/apps.json). Whiteboard's backend image advances with its app. The Talk configuration revision also advances to pull the current floating AIO backend image; an older cached signaling server can lack features required by Talk 25. The other installed app pins already declare compatible server and PHP ranges; preserve them rather than taking unrelated updates or downgrading Mail based on app-store response ordering.

Follow the maintenance and backup procedure below before publishing these pins. The installer preserves mode `2775` on the app-export root so `OnRootMismatch` can skip repeated recursive ownership changes on later mounts. The app installer replaces code on the shared NFS export, so replacing one pod can also change the app files seen by an older replica. Isolate all replicas and pause cron, task workers, and integrations for the whole migration; a normal rolling update does not provide this protection. Do not force-enable incompatible apps. After the single-owner migration, exercise AI tasks, Talk calls, Group folders permissions, and Whiteboard collaboration/recording as well as the core file and login flows.

## 2. Establish a protected maintenance window

Pause user writes and background processing across the whole service, including integrations that write files. Keep public ingress isolated throughout rollout and migration, because newly created pods regenerate their own configuration. Maintenance mode in one existing pod does not automatically protect every other or replacement pod.

Use a reviewed temporary maintenance configuration for ingress/background workers that fits your deployment. Keep the database, object store, and administrator exec access available. Record how each temporary change will be removed. Do not allow normal traffic to resume just because a new pod is Running.

Find the current pods and record the current images:

```bash title="Identify current replicas"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n nextcloud get pods -l app.kubernetes.io/name=nextcloud \
  -o custom-columns='NAME:.metadata.name,IMAGE:.spec.containers[0].image,READY:.status.containerStatuses[*].ready'
```

The following enables maintenance on a selected existing pod. Repeat as required for the currently serving replicas while traffic remains isolated:

```bash title="Enable maintenance on a selected current pod"
NEXTCLOUD_POD='REPLACE_WITH_CURRENT_POD'
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n nextcloud exec "$NEXTCLOUD_POD" -c nextcloud -- sh -ec '
    chmod 0640 /var/www/html/config/config.php
    trap "chmod 0440 /var/www/html/config/config.php" EXIT
    su -s /bin/sh www-data -c \
      "NC_config_is_read_only= php /var/www/html/occ maintenance:mode --on"
  '
```

Use an **empty** `NC_config_is_read_only` value for the temporary override. The string `false` is nonempty and can be treated as true by the application’s environment handling.

## 3. Take a coordinated recovery point

Back up PostgreSQL, the Garage objects, original secrets/salt, Git configuration, and non-reconstructable NFS data after writes are paused. The database manifest does not configure a scheduled off-cluster Nextcloud backup. A logical dump is a useful minimum database artifact, not the entire recovery set.

Select the actual cluster name from `NEXTCLOUD_DATABASE_CLUSTER`:

```bash title="Dump the current database primary to private local storage"
NEXTCLOUD_DB_CLUSTER='REPLACE_WITH_NEXTCLOUD_DATABASE_CLUSTER'
NEXTCLOUD_DB_PRIMARY=$(
  /home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
    -n nextcloud get cluster "$NEXTCLOUD_DB_CLUSTER" \
    -o jsonpath='{.status.currentPrimary}'
)

install -d -m 700 "$HOME/.kubernetes-backups"
umask 077
NEXTCLOUD_DUMP="$HOME/.kubernetes-backups/nextcloud-$(date +%Y%m%d-%H%M%S).dump"

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n nextcloud exec "$NEXTCLOUD_DB_PRIMARY" -c postgres -- \
  pg_dump -d nextcloud -Fc -Z 6 > "$NEXTCLOUD_DUMP"
```

This command dumps only the `nextcloud` database. If using Context Chat, also back up the separate `ccb` database and its managed-role configuration as part of the same recovery point. Confirm the dump can be read and copy the full recovery set to durable external storage before migration. Record the matching object-store recovery point. Restoring a database from one time against unrelated object data can leave the installation inconsistent.

## 4. Publish the target configuration

Update the selected image tag, exact internal version, and configuration revision in `apps/variables.yaml`, with any required app-version/digest changes. Keep the approved maintenance isolation active while Argo CD replaces pods.

Select **one** pod running the target image. Inspect its actual internal version:

```bash title="Read the selected target image version"
NEXTCLOUD_NEW_POD='REPLACE_WITH_ONE_TARGET_IMAGE_POD'
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n nextcloud exec "$NEXTCLOUD_NEW_POD" -c nextcloud -- \
  php -r 'include "/var/www/html/version.php"; echo implode(".", $OC_Version), PHP_EOL;'
```

If that version differs from the recorded target, stop and correct the desired configuration before migrating.

## 5. Run the migration once

Record the installed internal version from the pre-upgrade service before changing the image (for example, `34.0.5.1` when upgrading to 35.0.2). Use that previous version for the migration process so Nextcloud recognizes the major-version boundary; the generated target configuration alone must not make an unmigrated database appear current. The upgrader writes the target version after success. Do not run the following concurrently on another replica:

```bash title="Migrate from one selected target pod"
NEXTCLOUD_PREVIOUS_INTERNAL_VERSION='REPLACE_WITH_PRE_UPGRADE_INTERNAL_VERSION'
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n nextcloud exec "$NEXTCLOUD_NEW_POD" -c nextcloud -- \
  sh -ec '
    chmod 0640 /var/www/html/config/config.php /var/www/html/data/.ncdata
    trap "chmod 0440 /var/www/html/config/config.php /var/www/html/data/.ncdata" EXIT
    su -s /bin/sh www-data -c \
      "NC_version=$1 NC_config_is_read_only= php /var/www/html/occ upgrade --no-interaction -v"
  ' sh "$NEXTCLOUD_PREVIOUS_INTERNAL_VERSION"
```

The temporary permissions and environment overrides are confined to this process; the trap restores file modes when it exits. Keep the complete migration log privately for diagnosis.

If migration changes the schema and then fails, do not downgrade the image against that database. Use the supported recovery procedure and the matching pre-upgrade database/object backup when a rollback is necessary.

## 6. Inspect status before reopening traffic

On each current replica, inspect application status and confirm its image/internal version agree:

```bash title="Read Nextcloud status"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n nextcloud exec "$NEXTCLOUD_NEW_POD" -c nextcloud -- \
  su -s /bin/sh www-data -c 'php /var/www/html/occ status --output=json_pretty'
```

The application must report installed state and no database upgrade requirement. Disable any retained maintenance flag on each affected current pod using the same temporary read-only override:

```bash title="Disable maintenance after successful migration"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n nextcloud exec "$NEXTCLOUD_NEW_POD" -c nextcloud -- sh -ec '
    chmod 0640 /var/www/html/config/config.php
    trap "chmod 0440 /var/www/html/config/config.php" EXIT
    su -s /bin/sh www-data -c \
      "NC_config_is_read_only= php /var/www/html/occ maintenance:mode --off"
  '
```

Confirm both the web and notify_push containers become Ready and check status for each pod. Restore background processing and complete release-specific maintenance tasks, then remove the temporary ingress isolation. Keep the reviewed maintenance changes and their removal consistent with GitOps ownership.

## 7. Exercise the upgraded service

Run background jobs and inspect the administration overview for required database indices or other release-specific repair steps. Use supported dry-run options where the installed `occ` command offers them, then apply only the required changes. Avoid treating an old incident’s repair-command list as mandatory for every upgrade.

Test login, upload/download, a share, desktop sync, office save, Whiteboard, Talk, and any AI integration you use. Confirm Argo CD has the intended revision and that the current replicas are healthy. Keep the pre-upgrade recovery set until the application and background migrations are accepted.
