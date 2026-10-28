---
title: "Authentik · Operate"
description: "Deploy Authentik with antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="Authentik guide sections"><a href="/user-guide/authentik/">Use</a><a href="/infrastructure/authentik/">Architecture</a><a aria-current="page" href="/admin-guide/authentik/">Operate</a></nav>

This runbook deploys the service from `apps/authentik/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Prepare CloudNativePG, NFS CSI, ingress, DNS, and cert-manager before the application.

2. Set `AUTHENTIK_HOST`, the `AUTHENTIK_DATABASE_STORAGE_SIZE` and media variables, and the `AUTHENTIK_EMAIL_*` settings. Make the media export writable by the container identity specified in the chart.

3. Reseal `authentik-db-app`, `authentik-secrets`, and `authentik-email`. Keep the database password and chart Secret references consistent; preserve the application secret key when restoring an existing instance.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application authentik

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n authentik get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

On a new database, complete the upstream initial setup flow at `/if/flow/initial-setup/` and establish an administrator. Create one application/provider pair per relying application, bind the permitted users or groups, and copy the provider metadata into that app’s settings. Use the [SSO integration guide](/admin-guide/single-sign-on/) for the exact distinction between OIDC, SAML, and forward-auth. Provider objects are post-deployment configuration; the Kubernetes manifests alone do not create them.

## Application authorization

`apps/authentik/access-control/reconcile.py` manages the group layer using the
same `ak shell`/Django automation already used for provider configuration. Its
generated ConfigMap is mounted by the Authentik chart; the worker startup hook
runs the reconciler before the existing LDAP-outpost reconciliation. Regenerate
`apps/authentik/access-control.yaml` with
`python3 apps/authentik/access-control/render-configmap.py` after editing it.
It discovers Application objects, including providerless dashboard links, and
reuses their providers. Unattached providers/outposts do not get application
groups. Rerun after creating an application; discovery runs at worker startup,
not continuously after every directory change.

For Argo CD, `ARGOCD_AUTH_HOST` adds its native OIDC `/auth/callback` URI to the
existing provider at worker startup. It preserves existing redirect URIs and
client credentials. Reconcile this change and verify the new callback before
switching Argo CD from Dex to native OIDC; see the [migration sequence](/admin-guide/argocd/#migrate-an-existing-dex-integration).
Server and worker PDBs each retain one available pod during voluntary eviction.
Both roles can use the RTX worker through the quorum toleration; required
hostname anti-affinity still separates replicas.

Every application gets `<slug>-users` and `<slug>-admins`. Authentik inherits
membership **from child to ancestor**: the admins group has users as a parent.
An organization-specific umbrella group can inherit selected application admin
groups and a standard mail group. Assign its permitted identities explicitly;
these relationships do not grant Authentik superuser permissions.

`antalos-admins` is the global administrator group: it has Authentik superuser
status and inherits every application admin group and `antalos-users`.
`antalos-users` inherits every application user group without administrator
privileges. `antblu` is a direct member of `antalos-admins`. Existing `authentik
Admins` operators remain compatible by inheriting `antalos-admins`; application
admins do not inherit either global administrator group. A person needs only
one app admin group, or one global umbrella group, rather than duplicate direct
membership in each user group. Standard global users still cannot enter
integrations that expose only an administrator surface.

Legacy groups remain as compatibility children of the corresponding standard
group. Their names, members, existing application bindings, and downstream
references are retained. This includes Argo CD, Grafana, Jellyfin, Home Assistant,
Obsidian, Odoo, and Mautic. The existing `jellyfin-ldap` service account receives
`jellyfin-users` so the access gate preserves the LDAP client's bind access.
The existing misspelled `home-assitant` application slug is retained to preserve
its issuer and callbacks; its canonical group prefix is `home-assistant`. Legacy
misspelled group names remain compatibility children.

Most previously unbound applications now require their users group. Medusa,
Traefik, Homelable, UrBackup, Obsidian Live Sync, Vaultwarden administration, and
the Uptime Kuma admin proxy require their admins
group because those integrations expose a privileged surface. Medusa customers
use the storefront's separate customer authentication; `medusa-users` does not
turn a customer into a Medusa Admin actor. The public `uptime-kuma` status-page
bookmark intentionally remains unbound. New identities no longer gain access to
restricted applications merely by existing in Authentik. Existing policy and
user bindings are retained; a future application with expression or negated
bindings stops the migration for review instead of silently bypassing them.

OIDC providers receive a provider-specific profile mapping that emits
`request.user.all_groups()`, plus `application_role=admin|user`. The shared
upstream profile mapping remains unchanged. Both SAML providers receive an
effective-groups assertion named `http://schemas.xmlsoap.org/claims/Group`.
Cal.diy's existing blueprint declares the same effective mappings so its
periodic provider reconciliation does not remove them. Claims alone do not
configure a relying application's authorization.

### Downstream role adapters in source

| Application | Standard access | Administrator mapping |
| --- | --- | --- |
| Mautic | Existing non-admin `SSO Users` role | `mautic-admins` selects an existing `isAdmin` role by lookup; guarded image patch applies on new and returning SAML logins |
| Medusa | Separate storefront customer flow | Medusa Admin accepts only verified OIDC claims containing `medusa-admins`, before identity provisioning or login |
| Zammad | Built-in `Customer` role | Verified OIDC userinfo `zammad-admins` selects `Admin` and `Agent`; built-ins synchronize on login and custom roles remain |
| Odoo | Existing internal-user template | Validated `odoo-admins` grants `base.group_system`; its absence removes Settings/Access Rights administration on each JIT login |
| Stalwart | `User` account role and `stalwart-users` mail group | Dedicated `stalwart_groups` claim contains only the two mail-group addresses; the periodic native role synchronizer sets account `roles` to `Admin` for `stalwart-admins`, otherwise `User` |
| Argo CD | `role:readonly` | `argo-cd-admins` maps to `role:admin` |
| Grafana | `Viewer` | `grafana-admins` maps to organization `Admin` with role synchronization enabled |
| Forgejo | Normal native account | OAuth source maps `groups`/`forgejo-admins` through its native administrator-group option |
| Open WebUI | Normal `user` | Native OAuth role management reads the effective `groups` claim and selects `open-web-ui-admins` |
| Node-RED | Read-only editor/API | Verified userinfo `node-red-admins` selects `*`; role is bound to the authenticated, role-suffixed subject |

These changes are deployment inputs only after publication. Build the Mautic and
Medusa images at the updated tags before reconciliation. Odoo needs the new addon
revision loaded by both replicas; Zammad and Node-RED need their new configuration
mounted and processes restarted. Do not infer deployed application permissions
from the Authentik group graph or the presence of a role claim.

### Additional native integrations and operational limits

| Application | Native authorization mechanism |
| --- | --- |
| Rancher | Generic OIDC `groups` plus GlobalRoleBindings for native `admin` and `user` roles |
| Nextcloud | Existing user_oidc provider provisions `nextcloud_groups`; only `admin` and `nextcloud-users` are managed |
| Headplane | `headplane_role` selects native `admin` or `viewer` |
| LiteLLM | Generic SSO maps effective groups to `proxy_admin` or `internal_user` |
| SuiteCRM | Validated SAML groups synchronize native `is_admin` on login |
| Invoice Ninja | Validated OIDC groups synchronize the existing company membership's administrator flag |
| Immich | Existing native `immich_role` claim selects `admin` or `user` |
| Home Assistant | Existing auth_oidc integration options select `home-assistant-admins` and `home-assistant-users`; use `apps/home-assistant/tools/configure-access.py` with private `HOME_ASSISTANT_TOKEN` and explicit `HOME_ASSISTANT_URL` |
| Cal.diy | Existing OIDC-linked accounts synchronize native `ADMIN`/`USER` by exact email |
| Storyteller | Native group permissions provision new accounts; linked accounts' permissions are reconciled by exact email |
| Vaultwarden | Separate admin-only Authentik proxy application gates `/admin`; an in-pod Nginx authorization subrequest protects admin paths and native Rocket binds only to loopback; the NetworkPolicy is defense in depth |

The existing self-hosted runner runs `.github/workflows/authorization-sync.yaml`
every five minutes for Stalwart, Cal.diy, and Storyteller. It uses the existing private
checkout kubeconfig and Debian SSH alias; runner availability bounds role-change
propagation. Run `sync-native-roles.py --root /path/to/private/checkout` manually
when immediate synchronization is needed. Local recovery accounts are preserved.

Jellyfin's external endpoint returned HTTP 502 during implementation; its native
LDAP role settings could not be verified or updated. Existing LDAP groups and
credentials remain intact. Nextcloud reports an outstanding native upgrade,
which blocks login verification. Homelable and UrBackup are gated as privileged
surfaces; separate lesser native roles have not been established. BentoPDF and
VictoriaLogs have no separate native administrator role in these integrations.
These limits prevent claiming complete native role verification for every app.

### Apply and verify the group layer

From the repository root, after the mounted source is published:

```bash
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n authentik exec deploy/authentik-worker -- ak shell -c \
  "exec(compile(open('/access-control/reconcile.py').read(), '/access-control/reconcile.py', 'exec'))"
```

Before publication, the same source can be passed through stdin to `ak shell`;
supply `STALWART_AUTH_GROUP_DOMAIN` from `MAIL_DOMAIN`. Do not apply unresolved
Kubernetes manifests. The reconciler uses an atomic database transaction and an
advisory lock, resolves objects by name/slug, and verifies the configured
identities' effective membership before committing. It does not remove unrelated objects.

`access-control/test.py` is intended to run after the reconciler inside a
rollback-only outer transaction. It checks the actual Authentik policy engine,
emitted OIDC/SAML claims for both accounts, Stalwart's standard-only claim, and
denial of an ungrouped identity for every restricted application. The Mautic
adapter contract test is `apps/mautic/saml/test-roles.php`; Zammad's
`apps/zammad/tests/authentik-roles.rb` runs with the source initializer loaded
inside a rolled-back Rails transaction. Odoo's existing rollback tests exercise
administrator grant/removal and missing-group denial. Medusa's image build runs
its token-validation and callback tests.

On 2026-10-23, the group reconciler was applied directly to the live Authentik
database and both requested users passed effective-membership and policy/claim
checks. Stalwart's existing OIDC directory was updated to read its scoped claim;
its two mail groups were created and existing matched accounts were migrated to
normal direct roles plus group-derived access. The scoped mail identities were
assigned standard access, including removal of a former direct administrator role. These facts are separate from deployment of the
application adapters and from a real browser login. No end-user browser login
was performed for this migration.

During the subsequent deployment on 2026-10-23, the Mautic and Medusa image
tags were published and both serving/worker tiers reached two ready replicas.
All applications changed by the authorization deployment reported Synced and
Healthy. Deployed Mautic, Zammad, and Odoo grant/removal/denial tests passed,
alongside the Authentik policy/claim and repeat-run checks. Vaultwarden passed
authenticated HTTP admin access, unauthenticated redirect, direct-backend 401,
and loopback-listener isolation checks. Its NetworkPolicy alone was found not
to enforce isolation in this cluster; the in-pod gateway provides enforcement.
Nextcloud's native group configuration was applied, but its database still
reports `needsDbUpgrade: true`; readiness does not establish login success.
Jellyfin continued to return HTTP 502. No claim of full end-user login coverage
is implied by these deployment and adapter tests.

[Authentik group inheritance](https://docs.goauthentik.io/users-sources/groups/)
and [Stalwart OIDC directory behavior](https://stalw.art/docs/auth/backend/oidc/)
describe the upstream semantics used here.

## 4. Connect and operate the service

1. Configure and test outbound email before relying on password recovery. The declared SMTP endpoint is Stalwart, so retain a recovery path that does not depend on both services being healthy.

2. Test each new provider with an ordinary user and with an account that should be denied. Confirm the application grants the intended role.

3. For proxy applications, add the provider to the embedded outpost and create a callback route on the protected application hostname.

## Availability before maintenance

**Partially HA: replicated identity processing and database; external shared media and maintenance limits remain.**

Server and worker rolling updates use zero surge and one unavailable replica. No application PDB is explicitly declared here, so do not assume a normal drain enforces a one-healthy-server minimum.

Protect or remove the shared-media failure boundary, explicitly budget voluntary disruption, protect the CNPG control path, and record a login/provider transaction during a controlled primary and worker failure.

Use the [component-by-component failure contract](/infrastructure/authentik/#availability-and-failure-behavior) before a node drain, database promotion, or upgrade. Restoring a healthy replica count must include data resynchronization and restored voting capacity, not just Running pods.

## 5. Maintain and recover

Back up PostgreSQL, the media export, and the original `AUTHENTIK_SECRET_KEY`. The database holds users, provider definitions, policy bindings, and flows. Restoring pods from Git does not recreate provider configuration stored in that database.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

### LDAP outpost upgrades

Keep **LDAP Outpost** attached to the **Local Kubernetes Cluster** integration, with `container_image: null` and the `deployment` component enabled. Authentik owns its generated Deployment, Service, and token Secret; do not add a separately pinned LDAP Deployment to Git. The default image template derives the LDAP tag from the running Authentik version, so `AUTHENTIK_CHART_VERSION` remains the only release input.

The worker's `postStart` hook in `apps/authentik/app.yaml` immediately reconciles managed LDAP outposts through Authentik's controller, using the new worker's version. This avoids waiting for the upstream four-hour controller schedule and avoids dispatching an upgrade task to an older worker during a rolling update. It preserves the outpost's configured Kubernetes patches and disabled components. The hook runs on worker restarts as well as upgrades; controller failures fail the hook and surface as `FailedPostStartHook` events. It uses Authentik's internal Python controller API, so verify it when upgrading Authentik.

After publishing the change and after every upgrade, check the image versions and LDAP rollout:

```bash
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n authentik get deployments \
  -o custom-columns=NAME:.metadata.name,IMAGES:.spec.template.spec.containers[*].image,READY:.status.readyReplicas
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n authentik rollout status deployment/ak-outpost-ldap-outpost
```

Confirm an LDAP bind/search using an existing relying application separately; matching versions and ready pods do not prove credentials or provider permissions.

## Troubleshooting

If authentication loops, compare the requested callback URI with the provider allowlist, then check the issuer, signing keys, and server clock. If a protected hostname returns an outpost 404, inspect the host-specific outpost route and provider assignment before changing the protected application.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/certificate.yaml)
- [`db-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/db-secret.yaml)
- [`db.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/db.yaml)
- [`email-secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/email-secret.yaml)
- [`media-pvc.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/media-pvc.yaml)
- [`metrics.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/metrics.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/authentik/secrets.yaml)

[Official Authentik documentation](https://docs.goauthentik.io/).
