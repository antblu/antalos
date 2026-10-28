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

OCA [`auth_oidc`](https://github.com/OCA/server-auth/tree/19.0/auth_oidc) is installed with its standard `auth_oauth` dependency. The addon installer downloads the pinned `ODOO_OCA_SERVER_AUTH_REVISION` and installs `python-jose` at `ODOO_PYTHON_JOSE_VERSION`, both owned by `apps/variables.yaml`. Every serving pod receives these dependencies.

The retained `odoo-auth-oidc-v1` Job runs at Sync wave 1, after the HA bootstrap at wave 0. It checks whether the module is already installed, stops existing serving pods before schema installation, and leaves them stopped on failure. The Deployment now runs at wave 3, after the JIT installation at wave 2, and restores two replicas with the addons available. This first installation briefly interrupts access. Completed Job templates are ignored during subsequent syncs; changing the pins does not rerun database upgrades. If this Job fails, repair the cause and deliberately recreate it during a sync before allowing wave 2 to proceed.

Installation does not enable a provider. In developer mode, configure an OAuth Provider in Settings with **OpenID Connect (authorization code flow)**, client ID and secret, scope `openid email`, and the authorization, token, and JWKS endpoints from the provider's discovery document. Register `https://odoo.antblu.net/auth_oauth/signin` as its redirect URI. Store any repository-managed client secret only in an application-owned SealedSecret. Enable the provider only after reviewing its account-linking and signup policy. Keep the existing local administrator available. Verify a real login and logout separately once provider configuration is supplied.

## Authentik JIT provisioning

The local `authentik_jit` addon lives in `apps/odoo/addons/authentik_jit/`. After editing it, run `python3 apps/odoo/addons/render-configmap.py` from the repository root and commit the generated `apps/odoo/jit-addon.yaml` alongside the source. Its ConfigMap is mounted as a normal addon directory in the installer and copied to `/mnt/extra-addons/authentik_jit`, which is already on Odoo's addons path. No `/opt/odoo` guest deployment is involved.

`odoo-authentik-jit-v1` runs at Sync wave 2 after the OCA installation. It generates runtime configuration, takes the existing advisory lock, stops and waits for all serving pods, installs the addon, and configures the selected provider through the ORM. The serving Deployment resumes at wave 3. A failed installation leaves serving stopped for deliberate repair and retry. Completed Job templates are ignored; future schema changes require a new versioned installation Job. Increment `ODOO_JIT_ADDON_REVISION` when changing addon code so serving pods receive the updated ConfigMap contents.

`ODOO_JIT_PROVIDER_NAME` selects the existing enabled `antID` provider. `ODOO_JIT_TEMPLATE_LOGIN` selects the existing active internal template `jit-template@invalid.local`, displayed as `_JIT Internal User Template`. These shared selectors live in `apps/variables.yaml`. The Job enables JIT, selects that template, and enables verified-email linking. It selects the OCA authorization-code flow (`id_token_code`) and preserves the provider's endpoints, client credentials, and signup settings. The follow-up `odoo-jit-oidc-v1` Job at wave 4 also reconciles this correction for installations where the earlier JIT Job had already completed. It does not modify the database schema or stop serving. A provider left on the core access-token flow sends a response type Authentik can reject before JIT executes. A fresh database must have that provider and template prepared before this Job can succeed. Provider credentials remain in the database; no credentials are copied into the addon or ConfigMap.

For a provider with JIT disabled, the addon delegates to normal Odoo/OCA behavior. With JIT enabled, every identity requires validated `groups` containing `odoo-users`. Each login synchronizes Settings administration: `odoo-admins` grants `base.group_system`; its absence removes that group and `base.group_erp_manager`. Local-only recovery logins do not use this JIT path. Other application groups remain unchanged. A new identity requires a nonempty subject and an explicit boolean `email_verified=true` claim from the already validated provider response. Initial email matching compares login and email without case sensitivity, rejects ambiguous or inactive matches and conflicting OAuth links, and never links the template. A unique eligible existing user receives the provider/subject link and the same administrator-role synchronization. Otherwise, a new user receives only the template's groups and company access, with a fresh partner and no copied password or API keys. Later logins use the subject rather than repeatedly matching email. New-user creation flushes computed fields under the provisioning user before returning to the anonymous OAuth controller; otherwise its commit can recompute SVG avatars without a user and fail with `Expected singleton: res.users()` before the account is committed. Providers must be trusted to verify email ownership; requesting the `email` scope alone does not establish verification. Account creation or linking is suppressed when the caller sets `no_user_creation`.

The preparation boundary is **before login tests**. The installation/configuration Job does not call the signin method, fabricate claims, create test users, or perform a JIT login. After the deployment is ready, manually check Settings → Users & Companies → OAuth Providers → antID for the three JIT settings. The operator then performs the existing-identity, verified-email linking, and new-user provisioning tests. If claims lack the boolean verification flag, the login fails closed. Inspect provider-side claims and verification policy rather than weakening this requirement.

### JIT troubleshooting and verification record

Live troubleshooting on **2026-10-21 (America/Denver)** found two independent failures: the provider used `access_token` instead of `id_token_code`, and new-user avatar recomputation failed during the anonymous OAuth controller's commit. The flow configuration Job and the privileged flush in the addon fix those paths. After both serving pods loaded addon revision 2, an operator completed a fresh Authentik login. Odoo logged successful authentication and a 303 callback, and the other replica served `/web` with HTTP 200. The new account was active, internal, and matched the template's group IDs, company IDs, and default company. Argo CD was Synced/Healthy with two ready serving replicas.

The rollback-only checks in `apps/odoo/tests/jit-provisioning.py` passed for new internal-user creation, template access, repeat subject login, verified-email linking, unverified-claim denial, and archived-user denial without replacement. `apps/odoo/tests/jit-anonymous-flush.py` reproduces the callback's anonymous default environment and confirms the commit-time flush succeeds. Run these scripts through `odoo shell --config=/run/odoo/odoo.conf --no-http` on a serving pod, using stdin; their test identities are rolled back. Authentik's live policy engine allowed the test identity in **Odoo Users** and denied the outsider. The full negative browser flows were not completed; automated authentication reached CAPTCHA. The two Authentik-only test accounts were disabled after diagnostics.

The current Authentik **Verified Email** mapping unconditionally asserts `email_verified=true`. That claim depends on trusted email data and does not independently establish mailbox ownership. The rollback rejection test supplied a false claim at the JIT boundary; it did not prove the current mapping emits false for an unverified mailbox. Maintain an appropriate Authentik email-verification or administrator-controlled email policy before relying on verified-email account linking for self-managed identities.

For offboarding, remove Authentik **Odoo Users** membership and archive the Odoo account. Existing Odoo sessions require separate revocation according to the incident or offboarding policy. The addon performs template assignment, identity linking, and administrator-role synchronization at SSO login. It does not revoke existing sessions when group membership changes.

## Medusa catalog reader

Catalog ACLs are deferred for models that are not installed. After the catalog modules are installed, run the provisioning tool with `--reconcile-access` to grant their read permissions while preserving the existing API key. Keep Medusa synchronization disabled until the required models and ACLs are present.

Medusa's optional catalog integration uses a dedicated `medusa-integration` account and a **Medusa Catalog Reader** group, with read-only catalog ACLs and a persistent RPC-scoped key. It has no password, Internal User role, or Authentik JIT identity. Provision it using the [Medusa integration procedure](/admin-guide/medusa/#odoo-catalog-integration); the owning credential is sealed in `apps/medusa/odoo-secret.yaml` for the consuming namespace. This is a one-way product integration; no Odoo inventory, order, or customer writes are performed. Archiving the account or revoking its key stops future synchronization. Odoo database backups preserve its account, ACLs, and key hash; preserve the sealed credential separately for Medusa recovery.

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

Live verification on **2026-10-21 (America/Denver)** after the OIDC installation confirmed the installation Job completed, both serving replicas were ready on distinct workers, and both loaded `auth_oidc` version `19.0.1.0.0` with `python-jose` version `3.5.0`. RSA token signing/verification passed in each replica. The public HTTPS login page returned HTTP 200, the existing administrator authenticated, and the same authenticated session worked through both replicas; the verification session was then logged out. Those initial OCA-installation checks did not include an identity-provider login; the later JIT verification is recorded above. Database failover, attachment access, and backup restoration were not exercised by these checks; assess those separately before claiming current recovery or failover guarantees.

The scale API may omit `spec.replicas` when its value is zero. The bootstrap launcher treats an omitted field as zero so a completed migration can restore both serving replicas.

## Optional Medusa commerce bridge

`apps/odoo/addons/medusa_bridge/` supplies a separate optional addon; render its
ConfigMap with `python3 apps/odoo/addons/render-commerce-configmap.py`. The init
container copies its files into the existing addon directory. Mounting the code
does not install its database models. The versioned `odoo-commerce-v1` Sync-wave-2 Job installs `medusa_bridge`
and its Product, Sales and Inventory dependencies. It takes the existing advisory
lock, stops serving pods and waits for their termination before changing the
schema. Wave 3 restores the two addon-equipped replicas. Failure leaves serving
stopped for deliberate repair; do not run concurrent schema installations.
Completed Job templates are ignored, so future upgrades require a new versioned
Job and a maintenance plan. Take a completed backup and run
`apps/odoo/tests/commerce-acceptance.py` through `odoo shell` in an isolated database
before the operational installation. The test rolls back its commerce records. Existing authentication and
storage addons remain independent.

The addon uses unique sales-order/event references and transaction-scoped locks
for remote idempotency. It rejects missing/ambiguous SKUs, nonmatching totals or
taxes, and ambiguous currency pricelists. Assign the integration group and minimum
required Sales/Inventory rights to the integration account; it does not use sudo
for order operations. Posted invoices or completed pickings prevent automatic
cancellation. Confirmed-refund receipts are audit records, not posted accounting
credit notes or new payment-provider refunds.

The optional fulfillment cron starts inactive. It requires an explicit Medusa
fulfillment mapping on each picking, actual tracking information, an HTTPS
`MEDUSA_FULFILLMENT_URL`, and a shared `FULFILLMENT_WEBHOOK_SECRET`. Add that key
through service-owned SealedSecrets, not a public ConfigMap. Delivery is recorded
only from explicit delivery evidence. Check queued failures separately from Odoo
readiness. Inventory quantities are not synchronized by this addon.


After installation, reconcile the existing catalog ACLs with
`python3 apps/medusa/tools/provision-odoo-integration.py --reconcile-access`, then
use `--commerce-access` to add the bridge, Contact Creation, Sales user and Inventory user groups to
the existing integration identity without rotating its API key. These are standard
operational user roles, with broader rights than a catalog reader; they do not
grant Settings, Sales manager or Inventory manager access. Re-running the
catalog-only verifier after granting commerce roles deliberately refuses the
changed role contract. Keep order export and the fulfillment cron disabled until
real SKU, currency, tax, shipping and fulfillment mappings are accepted. Installing
modules does not create those business mappings.

Backup Jobs install only their S3 client dependency. They do not install Odoo
addons, require custom-addon mounts, or require a Kubernetes service account.
