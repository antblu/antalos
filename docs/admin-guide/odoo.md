---
title: Odoo · Operations
description: Two-node deployment, initial access, online S3 backups, and recovery.
---

<nav class="guide-switcher" aria-label="Odoo guides"><a href="/user-guide/odoo/">Use</a><a href="/infrastructure/odoo/">Architecture</a><a aria-current="page" href="/admin-guide/odoo/">Operate</a></nav>

Review the [architecture](/infrastructure/odoo/), [shared deployment workflow](/admin-guide/deploy-an-application/), [official Odoo Docker image](https://hub.docker.com/_/odoo), [OCA S3 attachment addons](https://github.com/OCA/storage/tree/19.0), and [OCA PostgreSQL sessions](https://github.com/OCA/server-tools/tree/19.0/session_db) before changing topology. Odoo Enterprise requires a separate licensed addon deployment.

## Deployment and ownership

`apps/odoo/app.yaml` selects `main` and `yaml-envsubst`. The root app-of-apps discovers it after publication. Until uncommitted source is published, rendered resource submission is a temporary bootstrap and does not establish Argo CD reconciliation. Do not apply unresolved placeholders or point an automated Application at a missing source path.

Two Odoo serving replicas and two CNPG PostgreSQL instances are separated across the left/right workers. Shared sessions live in PostgreSQL through `SESSION_DB_URI=odoo`, which uses Odoo's configured database connection and required TLS. Both session and application data therefore follow the same CNPG primary Service and replication policy. The serving pods have no persistent-volume dependency.

The one-time `odoo-bootstrap-ha-v1` Job runs at Sync wave 0 after credentials, the database, configuration, and legacy PVC. It holds an advisory lock while preparing the database, installs missing storage modules, and copies legacy local attachment contents into PostgreSQL in one transaction. S3-backed attachments are left in S3. Original local files and the PVC remain intact; `Prune=false` preserves the recovery PVC. Missing source files abort migration instead of creating empty attachment records. Serving init containers wait for the `antalos.odoo.ha_ready` marker before starting HTTP.

For the initial singleton-to-HA transition, suspend the old backup CronJob and submit the updated Deployment with a temporary replica count of zero before submitting the bootstrap Job. The Job waits for old serving pods to terminate, migrates, then restores the Deployment to two replicas. The checked-in desired count is two. A fresh GitOps installation creates that Deployment in wave 1 after the Job completes. The transition interrupts access once; old filesystem sessions are not imported, so users must sign in again.

Do not rerun schema initialization against serving replicas. An ordinary completed bootstrap Job is retained, not recreated on every Sync. The Application ignores its immutable pod template and respects that exclusion during sync, so runtime input changes do not block later waves. Serving init containers reconcile the storage configuration through the Odoo ORM under the bootstrap advisory lock after the readiness marker exists; they do not rerun schema installation or legacy migration. Publish changes to `ODOO_S3_ENDPOINT` and allow the serving Deployment to roll so the database storage record and process caches pick up the new endpoint. Use a new versioned Job and an explicit maintenance plan for future migrations. If bootstrap fails, repair the cause and deliberately retry that Job while the Deployment remains stopped; do not bypass its readiness marker.

DNS and the edge route must deliver `odoo.antblu.net` to Traefik. The Ingress and Certificate do not create external DNS or firewall rules. Init containers download pinned addon source revisions and install direct Python dependency versions from `apps/variables.yaml`; startup depends on GitHub and PyPI, and transitive Python dependencies resolve at installation time.

## OpenID Connect addon

OCA [`auth_oidc`](https://github.com/OCA/server-auth/tree/19.0/auth_oidc) is installed with its standard `auth_oauth` dependency. The addon installer downloads the pinned `ODOO_OCA_SERVER_AUTH_REVISION` and installs `python-jose[cryptography]` at `ODOO_PYTHON_JOSE_VERSION`, both owned by `apps/variables.yaml`. Every serving pod receives these dependencies.

The retained `odoo-auth-oidc-v1` Job runs at Sync wave 1, after the HA bootstrap at wave 0. It checks whether the module is already installed, stops existing serving pods before schema installation, and leaves them stopped on failure. The Deployment at wave 2 restores two replicas with the addon available. This first installation briefly interrupts access. Completed Job templates are ignored during subsequent syncs; changing the pins does not rerun database upgrades. If this Job fails, repair the cause and deliberately recreate it during a sync before allowing wave 2 to proceed.

Installation does not enable a provider. In developer mode, configure an OAuth Provider in Settings with **OpenID Connect (authorization code flow)**, client ID and secret, scope `openid email`, and the authorization, token, and JWKS endpoints from the provider's discovery document. Register `https://odoo.antblu.net/auth_oauth/signin` as its redirect URI. Store any repository-managed client secret only in an application-owned SealedSecret. Enable the provider only after reviewing its account-linking and signup policy. Keep the existing local administrator available. Verify a real login and logout separately once provider configuration is supplied.

## Initial administrator access

Open `https://odoo.antblu.net/web/login` with login `admin`. Retrieve the generated initial password privately:

```bash
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n odoo get secret odoo-app -o jsonpath='{.data.admin-password}' | base64 --decode
```

The separate `master-password` protects database management. Database listing is disabled and the database filter fixes access to `odoo`. Do not publish credentials. Changing the bootstrap Secret does not rotate an existing Odoo user's password; use Odoo's account controls. Existing administrator credentials survive the HA migration.

## Garage attachments and backups

Service-specific settings use `http://10.30.0.5:30188`, region `garage`, bucket `odoo`. The `odoo-s3` SealedSecret supplies credentials to both serving replicas and backup Jobs. The `garage_odoo` storage record contains environment references rather than access secrets. Odoo streams private objects through its own authentication; no public bucket is required.

New attachments use `attachments/`; small images and web assets retain PostgreSQL defaults. Legacy local files imported during HA migration are now database attachments. Remote garbage collection is disabled, preserving object versions referenced by database snapshots. Do not manually remove or overwrite live attachment objects while relying on these backups.

The `odoo-backup` CronJob runs daily at **09:00 UTC** (03:00 Denver daylight time, 02:00 standard time), with overlapping runs forbidden. It takes an online custom-format `pg_dump`, copies retained S3 attachment versions, and writes `backups/<UTC timestamp>/COMPLETE.json` last. The backup container has no mounted Kubernetes API token, does not mount the legacy PVC, and never scales serving replicas. Its process timeout is two hours. New HA backups contain `database.dump`, `attachments/`, and the completion manifest; older singleton backups may also contain `local-data.tar.gz`.

The database snapshot precedes the object listing/copy. This relies on normal OCA attachment writes creating immutable versioned objects before committing their database references, and on retaining old objects. Extra objects copied after the snapshot are harmless. Enabling garbage collection or custom in-place edits invalidates this consistency assumption and requires a different backup design.

Only directories containing `COMPLETE.json` are completed backups. Failed copies may leave partial objects. No backup retention deletion or bucket lifecycle policy is installed. Active data and backups share Garage's failure domain; maintain an independent backup destination for loss of that service.

## Maintenance and recovery

For an application rollout, the desired replica count is two. Required anti-affinity, the rolling strategy, and the disruption budget keep one replica available while both workers are healthy. A PodDisruptionBudget does not protect against an involuntary node failure or an explicit scale-to-zero operation. Do not schedule elective maintenance on the remaining serving worker during degraded operation.

For a CNPG primary failure, allow the operator to promote the standby and reroute the `-rw` Service. Preferred synchronous durability allows writes without a standby, so a second failure can lose recent data. Restoring a failed member must preserve the surviving primary as authoritative.

To restore a completed HA backup, stop both Odoo replicas, restore `database.dump` into the matching database, and restore that backup's attachment objects into the active prefix before restarting two replicas. PostgreSQL includes the session table and imported legacy attachments. Per-pod local cache directories can be recreated. Preserve the original database name, `garage_odoo` storage code, administrator credentials, master password, and sealed credentials. The retained legacy PVC is recovery material, not a live data source or an independently current backup.

Change the Odoo image within 19.0 deliberately. Major releases and module upgrades need a supported migration procedure and maintenance plan; rolling incompatible schema versions is unsafe. Do not delete PVCs to repair a rollout.

Checks were explicitly skipped for this deployment. When verification is requested, assess source publication, Argo reconciliation, CNPG primary/standby placement and streaming health, two-node Odoo readiness, authenticated sessions across replicas, attachment access, controlled worker failover, and backup restoration separately.

The scale API may omit `spec.replicas` when its value is zero. The bootstrap launcher treats an omitted field as zero so a completed migration can restore both serving replicas.
