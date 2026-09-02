---
title: Updating Nextcloud
description: Safely upgrade Nextcloud while preserving read-only configuration and recoverable data.
sidebar:
  order: 2
---

## 1. Confirm the upgrade path

Check the currently healthy pod:

```bash
kubectl -n nextcloud get pods \
  -l app.kubernetes.io/name=nextcloud -o wide
```

Your current transition is:

```text
33.0.8 → 34.0.3
```

That is one major release and is allowed. Never skip a major version. Before advancing another major version, finish the current upgrade and its background migrations.

---

## 2. Discover the full internal version

The image tag and internal server version are not always identical. For `34.0.3-apache`, the internal version is `34.0.3.2`.

You can inspect a newly created pod:

```bash
POD=nextcloud-b9f4f6679-tmp96

kubectl -n nextcloud exec "$POD" -c nextcloud -- \
  php -r 'include "/var/www/html/version.php";
          echo implode(".", $OC_Version), " ", $OC_VersionString, PHP_EOL;'
```

Expected:

```text
34.0.3.2 34.0.3
```

For future updates, always run this check before setting `NEXTCLOUD_SERVER_VERSION`.

---

## 3. Correct `apps/variables.yaml`

Use separate variables:

```yaml
NEXTCLOUD_IMAGE_TAG: 34.0.3-apache
NEXTCLOUD_SERVER_VERSION: 34.0.3.2
```

Do not combine them.

The image uses the public three-component release, while `config.php` must match the full internal version.

Verify all references:

```bash
rg -n -S 'NEXTCLOUD_(IMAGE_TAG|SERVER_VERSION|VERSION)' \
  apps/variables.yaml \
  apps/nextcloud/app.yaml \
  apps/nextcloud/config.yaml

git diff --check
git diff -- apps/variables.yaml apps/nextcloud
```

Do not push the update until maintenance mode and backups are handled.

---

## 4. Enter maintenance mode

Because your configuration is deliberately read-only, temporarily make the old healthy pod's configuration writable.

Find the healthy old pod:

```bash
kubectl -n nextcloud get pods \
  -l app.kubernetes.io/name=nextcloud
```

Currently it is:

```bash
OLD_POD=nextcloud-544b467487-klsw8
```

Enable maintenance mode:

```bash
kubectl -n nextcloud exec "$OLD_POD" -c nextcloud -- \
  sh -ec '
    chmod 0640 /var/www/html/config/config.php
    trap "chmod 0440 /var/www/html/config/config.php" EXIT

    su -s /bin/sh www-data -c \
      "NC_config_is_read_only= php /var/www/html/occ maintenance:mode --on"
  '
```

Important: use an empty value:

```bash
NC_config_is_read_only=
```

Do **not** use:

```bash
NC_config_is_read_only=false
```

Nextcloud receives environment values as strings, and the nonempty string `"false"` is treated as true.

Confirm permissions were restored:

```bash
kubectl -n nextcloud exec "$OLD_POD" -c nextcloud -- \
  stat -c '%a %U:%G %n' /var/www/html/config/config.php
```

Expected mode:

```text
440
```

---

## 5. Take backups

Nextcloud recommends backing up the database, configuration, custom applications, themes, and data before every update.

Your CloudNativePG cluster currently has no `ScheduledBackup` or `Backup` resources, so take at least a logical database dump.

Identify the primary:

```bash
kubectl -n nextcloud get cluster nextcloud-db-s3 \
  -o jsonpath='{.status.currentPrimary}{"\n"}'
```

Set the returned pod name. For example:

```bash
DB_PRIMARY=nextcloud-db-s3-1
```

Create the dump outside the pod:

```bash
BACKUP="$PWD/nextcloud-pre-34.0.3.2-$(date +%Y%m%d-%H%M%S).dump"

kubectl -n nextcloud exec "$DB_PRIMARY" -c postgres -- \
  pg_dump -d nextcloud -Fc -Z 6 > "$BACKUP"
```

Validate it:

```bash
kubectl -n nextcloud exec -i "$DB_PRIMARY" -c postgres -- \
  pg_restore --list < "$BACKUP" | sed -n '1,20p'

ls -lh "$BACKUP"
```

Store this backup somewhere durable. A workspace file or `/tmp` is not a long-term backup.

You also need recoverable copies of:

* The S3-backed Nextcloud data bucket
* Sealed Secrets and their sealing-key recovery material
* Git-managed configuration
* Any user-installed custom applications or themes

---

## 6. Commit and push the corrected versions

Once maintenance mode and backups are complete:

```bash
git add apps/variables.yaml apps/nextcloud/app.yaml
git commit -m "Update Nextcloud to 34.0.3"
git push
```

Argo CD will start replacing the `33.0.8` pods with `34.0.3` pods.

The new pods may initially remain `1/2 Ready`; that is expected until the database/application migration finishes.

Watch the rollout:

```bash
kubectl -n nextcloud get pods \
  -l app.kubernetes.io/name=nextcloud -w
```

In another terminal:

```bash
kubectl -n argocd get application nextcloud -o wide
```

---

## 7. Select exactly one new pod for the migration

List images and pod names:

```bash
kubectl -n nextcloud get pods \
  -l app.kubernetes.io/name=nextcloud \
  -o custom-columns='NAME:.metadata.name,IMAGE:.spec.containers[0].image,READY:.status.containerStatuses[*].ready'
```

Choose one pod using `nextcloud:34.0.3-apache`:

```bash
NEW_POD=nextcloud-b9f4f6679-tmp96
```

Confirm its internal version:

```bash
kubectl -n nextcloud exec "$NEW_POD" -c nextcloud -- \
  php -r 'include "/var/www/html/version.php";
          echo implode(".", $OC_Version), PHP_EOL;'
```

Expected:

```text
34.0.3.2
```

Run the upgrade from **only one pod**. Do not run this concurrently on both replicas:

```bash
kubectl -n nextcloud exec "$NEW_POD" -c nextcloud -- \
  sh -ec '
    chmod 0640 \
      /var/www/html/config/config.php \
      /var/www/html/data/.ncdata

    trap "chmod 0440 \
      /var/www/html/config/config.php \
      /var/www/html/data/.ncdata" EXIT

    su -s /bin/sh www-data -c \
      "NC_version=34.0.3.2 NC_config_is_read_only= \
       php /var/www/html/occ upgrade --no-interaction -v"
  '
```

The temporary overrides do two things:

* `NC_version=34.0.3.2` makes the running migration process use the exact image version.
* `NC_config_is_read_only=` temporarily disables the read-only guard.

The trap restores both files to `0440` even if the upgrade fails.

**Do not downgrade the image if the migration has modified the database. Nextcloud does not support downgrades.**

---

## 8. Check whether maintenance mode was left enabled

Run:

```bash
kubectl -n nextcloud exec "$NEW_POD" -c nextcloud -- \
  sh -ec '
    chmod 0640 /var/www/html/config/config.php
    trap "chmod 0440 /var/www/html/config/config.php" EXIT

    su -s /bin/sh www-data -c \
      "NC_version=34.0.3.2 NC_config_is_read_only= \
       php /var/www/html/occ status --output=json_pretty"
  '
```

Healthy output must include:

```json
{
  "installed": true,
  "version": "34.0.3.2",
  "versionstring": "34.0.3",
  "maintenance": false,
  "needsDbUpgrade": false
}
```

If maintenance is still `true`:

```bash
kubectl -n nextcloud exec "$NEW_POD" -c nextcloud -- \
  sh -ec '
    chmod 0640 /var/www/html/config/config.php
    trap "chmod 0440 /var/www/html/config/config.php" EXIT

    su -s /bin/sh www-data -c \
      "NC_version=34.0.3.2 NC_config_is_read_only= \
       php /var/www/html/occ maintenance:mode --off"
  '
```

---

## 9. Wait for both replicas

```bash
kubectl -n nextcloud rollout status deployment/nextcloud \
  --timeout=10m

kubectl -n nextcloud get pods \
  -l app.kubernetes.io/name=nextcloud -o wide
```

Both pods should show:

```text
2/2 Running
```

Check `status.php` within each pod:

```bash
for POD in $(
  kubectl -n nextcloud get pods \
    -l app.kubernetes.io/name=nextcloud \
    -o jsonpath='{.items[*].metadata.name}'
); do
  echo "=== $POD ==="

  kubectl -n nextcloud exec "$POD" -c nextcloud -- \
    sh -c 'curl -fsS -H "Host: nextcloud.antblu.net" \
      http://127.0.0.1/status.php; echo'
done
```

Each response should report:

```text
"maintenance": false
"needsDbUpgrade": false
"version": "34.0.3.2"
```

---

## 10. Run post-upgrade checks

Run cron several times after a major update so scheduled migrations can progress:

```bash
for run in 1 2 3; do
  kubectl -n nextcloud exec "$NEW_POD" -c nextcloud -- \
    su -s /bin/sh www-data -c 'php /var/www/html/cron.php'
done
```

Check database maintenance recommendations first with dry runs:

```bash
for COMMAND in \
  db:add-missing-columns \
  db:add-missing-indices \
  db:add-missing-primary-keys
do
  kubectl -n nextcloud exec "$NEW_POD" -c nextcloud -- \
    su -s /bin/sh www-data -c \
    "php /var/www/html/occ $COMMAND --dry-run"
done
```

If a dry run reports required changes, rerun that command without `--dry-run`.

Then run:

```bash
kubectl -n nextcloud exec "$NEW_POD" -c nextcloud -- \
  su -s /bin/sh www-data -c \
  'php /var/www/html/occ maintenance:repair --include-expensive'
```

Inspect recent errors:

```bash
for POD in $(
  kubectl -n nextcloud get pods \
    -l app.kubernetes.io/name=nextcloud \
    -o jsonpath='{.items[*].metadata.name}'
); do
  echo "=== $POD ==="

  kubectl -n nextcloud logs "$POD" -c nextcloud \
    --since=10m
done
```

Finally verify the external URL and Argo CD:

```bash
curl -fsS https://nextcloud.antblu.net/status.php

kubectl -n argocd get application nextcloud
```

The essential rule for this deployment is:

```text
NEXTCLOUD_IMAGE_TAG       = public Docker tag, e.g. 34.0.3-apache
NEXTCLOUD_SERVER_VERSION  = exact $OC_Version, e.g. 34.0.3.2
```

Because the configuration is generated read-only and each pod uses `emptyDir`, upgrades must include this controlled one-pod migration procedure. Simply changing the two variables is insufficient.
