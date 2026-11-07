---
title: "Drupal · Operate"
description: "Deploy Drupal with shared NFS files and a two-instance CloudNativePG database."
---

The source in `apps/drupal/` defines two Drupal web replicas, one PostgreSQL primary and one streaming standby managed by CloudNativePG, and a retained NFS volume. It does not establish current workload health. Follow the [shared deployment workflow](/admin-guide/deploy-an-application/) to publish reviewed source and let Argo CD discover the Application.

## Prepare dependencies

Install CloudNativePG, OpenEBS local storage, the NFS CSI driver, Sealed Secrets, Traefik, and cert-manager first. Both main workers need capacity for PostgreSQL. DNS must route `DRUPAL_HOST` to ingress. The service owns its `letsencrypt-prod` Certificate.

Set the `DRUPAL_*` inputs in `apps/variables.yaml`: image pins, hostname, site name, administrator email, NFS server/export, UID/GID, and volume capacities. The NFS export must already exist and allow UID:GID `DRUPAL_UID:DRUPAL_GID` to create directories. No startup script changes export ownership. The pod sets `fsGroup` to the configured GID so local sites volumes are writable, with `OnRootMismatch`; the NFS CSI driver can adjust volume group permissions when the export root does not match. Prepare export ownership and group permissions before reconciliation to avoid a recursive ownership pass. PostgreSQL uses independent `openebs-local` volumes; do not put its data directory on the shared Drupal export. The NFS capacity is a Kubernetes binding value, not a server-side quota.

`registry.yaml` seals the existing cluster GHCR pull credential separately for this namespace; each Drupal pod references `drupal-registry`. Rotate it with the shared registry credential.

`drupal-db-secret.yaml` seals the database owner username/password; `drupal-app-secret.yaml` seals a persistent hash salt and initial administrator password. These files are namespace-bound to `drupal` and to the deployment's sealing controller. A different installation must seal its own credentials using the [credentials guide](/admin-guide/secrets/). Preserve existing credentials during restore.

## Bootstrap and verify

Argo CD orders namespace/storage/configuration and sealed credentials before the CNPG cluster, then runs `drupal-install-v1` and `drupal-configure-v1` as ordinary Sync Jobs before the web Deployment and ingress. The configure Job enables Authentik sign-in and seeds the welcome article. PostgreSQL bootstrap enables `pg_trgm`, required by Drupal. The installer creates a Standard-profile site without opening a public installation wizard. Completed Job templates are ignored because Kubernetes makes them immutable.

The initial administrator is `admin`. Retrieve its password through an authorized Secret viewer from `drupal-app`, key `admin-password`, in namespace `drupal`. Do not paste credentials into logs, Git, or documentation. Change the password and administrator email after first login. The sealed initial password does not reset an existing Drupal account.

After publication, inspect each evidence layer separately:

```bash
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n argocd get application drupal
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n drupal get clusters.postgresql.cnpg.io,pods,jobs,pvc,ingress,certificate
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n drupal logs job/drupal-install-v1
```

Confirm the database has two ready instances on different workers, installation completed, both web replicas are ready, and the Certificate is ready. Then verify trusted HTTPS at the configured hostname, administrator login, content creation, an uploaded file, and consistent retrieval through both replicas. DNS resolution alone does not prove external routing or TLS.

## Files, sessions, and proxy trust

Both web pods run as the configured UID/GID and serve Apache on port 8080. Each receives image-owned Drupal code and a local sites directory with environment-based settings. Shared NFS contains `files/` for public uploads, `private/` for private files, and `config/` for configuration exports. Only public files are linked beneath the web root. Sessions and Drupal caches use PostgreSQL, allowing requests to move between web pods without sticky sessions.

`DRUPAL_TRUSTED_PROXY_CIDR` must match the trusted ingress pod network. Drupal trusts forwarded client/protocol/port headers only from that range and accepts only the configured hostname. Keep the trust range as narrow as the network permits.

## Availability and recovery

The two web replicas use required host anti-affinity, a minimum-one PodDisruptionBudget, and a rolling update with zero surge and one unavailable pod. CNPG uses required anti-affinity on the main workers, promotes a standby, and routes writes through `drupal-db-rw`. Preferred synchronous replication requests one standby acknowledgement while allowing degraded operation when a standby is unavailable. A promotion can interrupt requests; writes during degraded operation can have a recovery-point gap.

NFS, ingress, DNS, network and Kubernetes management remain dependencies. Replicas are not a claim of uninterrupted whole-service availability. Replication is not backup: **this source does not configure scheduled database or NFS backups**. Establish independent PostgreSQL backups and export snapshots, retain the hash salt and credentials, and rehearse a restore before storing important content.

A successful installer rerun preserves an installed database. A partial installation stops for operator inspection; do not clear tables or delete volumes to retry. Check the CNPG primary, installation logs, NFS permissions, and pod events. Retained volumes require deliberate handling during recovery.

## Upgrades and extensions

The derived image in `apps/drupal/image/` supplies Drupal core, the stable OpenID Connect module, and a small application authorization module. `.github/workflows/drupal-image.yaml` builds and publishes it to `DRUPAL_IMAGE_REPOSITORY` using pins from `apps/variables.yaml`. The build updates Symfony packages within Drupal core-recommended constraints and fails on a Composer security audit finding. The module metadata uses a `.yml.in` source and is renamed during the image build so Argo CD does not render it as a Kubernetes resource. Additional modules/themes belong in this reviewed image; live changes to container code are ephemeral. Pin that image through the shared version inputs. Core/module updates can require database updates and cache rebuilds: take a backup, plan maintenance, and follow Drupal's upgrade guidance. The initial install Job is not an automated database upgrade mechanism. Do not roll back an image over a migrated database without a compatible restore plan. Scheduled cron and outbound mail are not configured here.

## References

- [Official Drupal image](https://hub.docker.com/_/drupal)
- [Drupal database requirements](https://www.drupal.org/docs/getting-started/system-requirements/database-server-requirements)
- [CloudNativePG replication](https://cloudnative-pg.io/documentation/current/replication/)

## Authentik OIDC

Publish the derived Drupal image before reconciling the changed workloads. Reconcile Authentik's `drupal-oidc` blueprint and paired sealed credential first, then Drupal. Both namespaces contain an independently sealed copy of the same confidential client secret. Never replace only one side. Increment `AUTHENTIK_DRUPAL_OIDC_REVISION` when rotating it and ensure the blueprint reapplies the changed provider value; rerun the Drupal configure Job and roll the web pods to reload their environment. The blueprint and the secret live under `apps/authentik/`; Drupal configuration stays under `apps/drupal/`.

The provider has application slug `drupal`, client ID `DRUPAL_OIDC_CLIENT_ID`, and the exact callback `https://<DRUPAL_HOST>/openid-connect/generic`. The stable 1.x module uses the `generic` client identifier; its login label is **antID**. Authorization, token and UserInfo endpoints use `AUTHENTIK_HOST`; claims request `openid`, `email` and `profile`. The client secret is an environment-backed settings override, so Drupal configuration exports contain no client secret. Do not put it in the Drupal settings form.

Authenticated access requires verified email and effective membership in `drupal-users`, `drupal-admins`, `antalos-users` or `antalos-admins`. The Authentik blueprint binds the application to those group paths; the existing startup authorization reconciler subsequently discovers the application and adds its normal umbrella relationships. Public blog reading remains anonymous. New SSO identities receive ordinary authenticated Drupal access; only `drupal-admins` or `antalos-admins` grant the Drupal `administrator` role. This role is removed on the next login if those memberships are absent. Already active sessions are not immediately revoked by group changes; revoke sessions separately when removing access urgently.

Automatic linking to an existing email address is disabled. Local Drupal registration is disabled, while permitted OIDC identities can be provisioned on first sign-in. The local UID 1 administrator remains a separate recovery account and SSO login as that account is rejected. Do not link the recovery account. Connect any other existing account explicitly through its authenticated Connected Accounts screen. If the recovery administrator and an Authentik identity share an email address, give the recovery account its own monitored address before provisioning the federated account; do not enable automatic email linking to resolve the collision. Keep the local login form alongside the antID button.

After deployment, verify an allowed user's redirect, callback, account creation, logout and subsequent login; a forbidden user's denial; and administrator role grant/removal. An actual Authentik browser/token exchange is required to establish working SSO. The source alone does not establish that result.

`drupal-configure-v1` is a retained, ordinary Sync Job. To reapply settings after a reviewed change, introduce a new Job name and matching `ignoreDifferences` entry rather than modifying a completed immutable Job. Configuration is reapplied by that Job; the welcome article is seeded only once. Image changes alone do not rerun completed Jobs.

## First article

The configure Job publishes **Welcome to Antblu's Blog**, promotes it to the default front-page listing, and assigns `/welcome`. It uses the local administrator as the initial author. The article introduces practical notes on self-hosting, homelab projects, Linux and infrastructure. Its initial text lives in `apps/drupal/image/welcome.html`.

The seed uses a fixed node UUID and a database state marker. Reruns preserve edits, avoid duplicates, and do not recreate a deliberately deleted article after a successful seed. An existing `/welcome` alias pointing elsewhere stops setup for review. Edit the article normally in Drupal after deployment.

- [Authentik's Drupal integration](https://integrations.goauthentik.io/platforms/drupal/)
- [Stable Drupal OpenID Connect module](https://www.drupal.org/project/openid_connect)

## Rendering typed identities

The Argo CD `yaml-envsubst` plugin preserves string tags during replacement.
Its shared renderer explicitly restores integer `runAsUser`, `runAsGroup` and
`fsGroup` fields in workload pod security contexts, including Jobs. Deploy the
renderer revision before reconciling Drupal. Validate with the actual plugin
output; plain text substitution followed by YAML parsing does not reproduce
this type behavior.
