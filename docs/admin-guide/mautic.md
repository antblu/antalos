---
title: Mautic operations
description: Build, deploy, verify and recover the Mautic marketing application.
---

Read [Mautic infrastructure](/infrastructure/mautic/) before deploying. All
application resources and sealed credentials live in `apps/mautic/`.

## Publish and install

Ensure `10.30.0.5:/mnt/nvme/mautic` exists and permits UID/GID `1010:1010` to
create and update files. Prepare DNS and routing for `mautic.antblu.net`. The PV
retains application data; it neither creates nor repairs the external export.

Build the image using `.github/workflows/mautic-image.yaml` or the Dockerfile under
`apps/mautic/image/`, passing `MAUTIC_BASE_IMAGE_TAG` and `PHPREDIS_VERSION` from the
shared variables. Make `MAUTIC_IMAGE_REPOSITORY:MAUTIC_IMAGE_TAG` readable by cluster
nodes before reconciliation. The workflow publishes on main and manual dispatch;
PR runs build without publishing. A push may trigger Argo before its image build
finishes; image pulls recover after the image becomes available. For upgrades,
publish a new immutable tag first, then update the deployment tag.

`registry.yaml` supplies the namespace-scoped `mautic-registry` SealedSecret and
adds it to the default service account's `imagePullSecrets`. It uses the existing
cluster GHCR pull credential, sealed separately for Mautic; package visibility
can remain private. Reseal that credential here when rotating registry access.
Existing pods do not inherit service account changes retroactively: recreate a
blocked install pod after the Secret is ready, then check its pull events.

Automatic builds prefer a ready self-hosted runner and fall back to GitHub-hosted Ubuntu if the Docker readiness probe does not succeed within roughly 60 seconds. Pull requests use hosted runners. Manual runs can select `auto`, `ubuntu-latest`, or `self-hosted`; the last choice explicitly waits for the workstation. See [runner selection](/admin-guide/docs/#runner-selection). A queued or successful probe has not published an image; verify the build-and-publish job separately.

If pod events report `applyFSGroup failed` on this export, verify that the pod
omits `fsGroup` and uses the local-volume permission init container. Do not loosen
private NFS directory permissions to accommodate kubelet's root identity. The
application accesses those files directly as UID/GID 1010.

Follow the [application deployment workflow](/admin-guide/deploy-an-application/).
Argo discovers `app.yaml` and uses main; local edits cannot be deployed until
published. Keep the install Job as a Sync hook at wave 0. Its dependencies are
created during earlier Sync waves, so PreSync would be too early.

The Galera configuration PVCs must share wave `-5` with the MariaDB resource.
OpenEBS uses `WaitForFirstConsumer`: those PVCs stay Pending until the database
pods are scheduled. Putting them in an earlier wave makes Argo wait for binding
before it creates their consumers, deadlocking a fresh deployment. The static
NFS PV/PVC can remain in wave `-6` because it binds without a consumer.

The installer creates local user `admin`, with its email from `MAUTIC_ADMIN_EMAIL`
and password from Secret `mautic-admin`, key `MAUTIC_ADMIN_PASSWORD`. Retrieve this
only in a protected operator terminal; do not copy it into logs or documentation.
Repeat installs do not reset existing account passwords. Credentials and the
application secret are sealed with the repository's Sealed Secrets controller.

Outbound mail starts disabled with `null://null`. Remove `MAUTIC_MAILER_DSN` from the ConfigMap and seal a real SMTP DSN under the
same key in `mautic-app`, then roll web and worker pods before enabling campaigns;
the initial null transport accepts and discards mail. Do not enqueue production
mail before completing that setup. SMTP credentials are not provisioned here.

## SAML with Authentik

### Shared request cache

Mautic stores outstanding SAML requests in its application cache, separately from
PHP sessions. Both web replicas must use the same cache; the filesystem default
stores requests in each pod's temporary directory. When the callback reaches the
other replica, validation cannot find the request and redirects to
`/saml/login_retry` with the generic authentication error.

The image's install hook runs `image/configure-cache.php` to configure Mautic's
[Redis application cache](https://devdocs.mautic.org/en/7.2/plugins/cache.html)
through the existing primary-routing Service. Cache entries use database 1 and
the `mautic_cache` namespace; PHP sessions remain in database 0. The script
preserves unrelated settings and stores the existing Redis credential only in
the protected shared `config/local.php`. Reapply it after rotating that credential.

For an existing installation, apply the script without waiting for an image build:

```bash
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n mautic \
  exec -i deploy/mautic-web -c mautic -- php \
  < apps/mautic/image/configure-cache.php
```

Then clear the compiled production cache on every web and worker pod using
`php bin/console cache:clear --env=prod --no-warmup`, one pod at a time. Cache
clearing can invalidate outstanding SAML requests; begin a fresh login after all
pods finish. Verify that a short-lived diagnostic `RequestState` written through
Mautic's `RequestStateStore` on one web pod can be read on the other, then remove
that diagnostic entry. Complete a normal browser SSO login separately.

### Provider and user configuration

The integration uses Mautic's native SAML support, following the
[Mautic authentication documentation](https://docs.mautic.org/en/7.2/authentication/authentication.html)
and [Authentik integration guide](https://docs.goauthentik.io/integrations/services/mautic/).
The repeatable scripts in `apps/mautic/saml/` configure application state after
deployment. Argo CD does not execute them; preserve both application databases and
NFS configuration when restoring this integration.

Run from the repository root, using the hostnames declared in `apps/variables.yaml`:

```bash
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n authentik \
  exec -i deploy/authentik-worker -- \
  env MAUTIC_HOST=mautic.antblu.net AUTHENTIK_HOST=auth.antblu.net ak shell \
  < apps/mautic/saml/configure-authentik.py
```

This creates the `mautic` application/provider, four dedicated attribute mappings,
and access bindings for `Mautic Users` and `authentik Admins`. It reuses the existing
`authentik Self-signed Certificate`; no signing private key leaves Authentik.
The provider sends signed responses and assertions by POST to
`https://mautic.antblu.net/s/saml/login_check`, with audience
`https://mautic.antblu.net`. The IdP entity ID and metadata URL are
`https://auth.antblu.net/application/saml/mautic/metadata/`.

Copy the configuration script and download the public IdP metadata into one web
pod, then configure shared NFS state:

```bash
MAUTIC_POD=$(/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n mautic get pods -l app.kubernetes.io/name=mautic-web \
  -o jsonpath='{.items[0].metadata.name}')
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n mautic \
  exec -i "$MAUTIC_POD" -c mautic -- sh -c \
  'umask 027; cat > /tmp/configure-mautic-saml.php' \
  < apps/mautic/saml/configure-mautic.php
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n mautic \
  exec "$MAUTIC_POD" -c mautic -- sh -ec \
  'curl --fail --location --silent --show-error https://auth.antblu.net/application/saml/mautic/metadata/ -o /tmp/mautic-idp.xml
   php /tmp/configure-mautic-saml.php /tmp/mautic-idp.xml'
```

The script preserves unrelated configuration, stores the metadata as Mautic's
expected base64 value, and maps `email`, `username`, `firstname` and `lastname`.
It creates a non-admin `SSO Users` role without permissions. Grant the appropriate
permissions to that ordinary role in Mautic before onboarding users. The guarded
SAML adapter in the application image selects an existing administrator role for
`mautic-admins` and `SSO Users` otherwise, on both first and returning logins.
The decision uses effective group attributes from the validated SAML response.
Deploy the updated image before relying on this behavior. Review username/email
collisions before adding members; SSO login now synchronizes the account role.
See [application authorization](/admin-guide/authentik/#application-authorization).

Clear the per-pod production cache on each web and worker pod after updating shared
configuration, using `php bin/console cache:clear --env=prod --no-warmup`. The next
CronJob process reads the shared settings. Re-download and apply metadata after
rotating Authentik's signing certificate. The scripts do not remove separately
added policy bindings; review them when changing access rules.

For a requested acceptance check, open `/saml/discovery`, complete normal Authentik
authentication, confirm the callback signs into Mautic with the expected role,
and confirm a user outside both permitted groups is denied. Do not treat successful
configuration commands as proof of browser login. Use `/s/login` with the preserved
local administrator for recovery. To disable SAML, remove the IdP metadata through
Configuration > User/Authentication Settings, then clear each pod's cache.
Use `/saml/discovery` as the SSO launch URL. In Mautic 7.2.1, directly opening
`/s/saml/login` without an `idp` query parameter triggers an upstream LightSAML
controller error (`ServiceLocator::getParameter()` is undefined). Discovery selects
the configured IdP and supplies that parameter. `/s/login` is the local password
form and does not authenticate an Authentik password.

Removing Authentik group membership blocks new authentication; separately revoke
existing Mautic sessions and disable the Mautic account for offboarding.

## Verify each layer

From the repository root:

```bash
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n argocd get application mautic
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n mautic get pods,jobs,cronjobs,pvc,certificate
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n mautic get mariadb,databases,users,grants
```

Check the rendered revision and Argo sync separately from readiness. Confirm the
install hook succeeds, both Galera data members are Synced in a Primary component,
and `garbd` participates. Confirm the primary Service routes to a healthy member.
Confirm one Redis primary and one replica, a healthy replication link and three
Sentinels with quorum two. Both proxies must report a usable primary.

Check `id` in web and worker containers and ownership of NFS files. Exercise HTTPS,
static assets, local login, a harmless configuration read and the same session
through both web pods. The login readiness probe alone does not prove successful
login or session persistence. Verify each scheduled command completes and both
workers consume harmless test jobs. Test outbound mail only with an authorized
recipient after SMTP setup; a null-transport job completion proves no delivery.
No mail is sent as a deployment check.

For an authorized failure drill, collect a baseline, interrupt only one component,
exercise the actual transaction, observe promotion/routing/reconnection, and verify
the returning member resynchronizes. Do not stop a second data member while degraded.

## Recovery and upgrades

Back up MariaDB and NFS config/media together, plus sealed application credentials,
the preserved application secret and Sealed Secrets recovery key. Keep independent
backup copies and test a restore with compatible Mautic code. Neither replication
nor a Retain PV protects against application deletion, corruption or export loss.

Review upstream release/migration notes before changing the base image. Build a new
image tag and plan schema compatibility or a maintenance interval. Existing pods
can run during a Sync migration; a rolling strategy does not guarantee compatibility
between an old process and a newly migrated database. Roll application pods after
changing shared config or credentials; new CronJob runs inherit the current inputs.

### Recovery after a dependency outage

A new web pod warms its own production cache in an init container after preparing local volumes. Cache generation retries while dependencies are unavailable and must finish before Apache starts. The per-pod `var` volume is ephemeral: a healthy peer's generated Doctrine proxies do not populate a replacement pod. If an older pod returns 500 with missing Doctrine proxy files after database recovery, run `php bin/console cache:clear --env=prod --no-interaction` on that affected pod and verify `/s/login` before returning it to service. `cache:warmup` alone can fail with the metadata-warmer priority error against an incomplete cache.
