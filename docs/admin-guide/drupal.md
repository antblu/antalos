---
title: "Drupal · Operate"
description: "Deploy Drupal with shared NFS files and a two-instance CloudNativePG database."
---

The source in `apps/drupal/` defines two Drupal web replicas, one PostgreSQL primary and one streaming standby managed by CloudNativePG, and a retained NFS volume. It does not establish current workload health. Follow the [shared deployment workflow](/admin-guide/deploy-an-application/) to publish reviewed source and let Argo CD discover the Application.

## Prepare dependencies

Install CloudNativePG, OpenEBS local storage, the NFS CSI driver, Sealed Secrets, Traefik, and cert-manager first. Both main workers need capacity for PostgreSQL. DNS must route `DRUPAL_HOST` to ingress. The service owns its `letsencrypt-prod` Certificate.

Set the `DRUPAL_*` inputs in `apps/variables.yaml`: image pins, hostname, site name, administrator email, NFS server/export, UID/GID, and volume capacities. The NFS export must already exist and allow UID:GID `DRUPAL_UID:DRUPAL_GID` to create directories. No startup script changes export ownership. Do not set pod `fsGroup` for this export: the NFS CSI driver can attempt a recursive ownership pass and fail on root-squashed private directories. A dedicated initializer with only the `CHOWN` capability sets ownership of the pod's emptyDir sites volume. It mounts no NFS data and has no API token. All NFS access and Drupal processes use the configured UID/GID. PostgreSQL uses independent `openebs-local` volumes; do not put its data directory on the shared Drupal export. The NFS capacity is a Kubernetes binding value, not a server-side quota.

`registry.yaml` seals the existing cluster GHCR pull credential separately for this namespace; each Drupal pod references `drupal-registry`. Rotate it with the shared registry credential. The image workflow uses the same existing publishing credential through the repository Actions secret `DRUPAL_GHCR_TOKEN`, falling back to `GITHUB_TOKEN` when package permissions allow. Rotate that Actions secret alongside the namespace pull credential.

`drupal-db-secret.yaml` seals the database owner username/password; `drupal-app-secret.yaml` seals a persistent hash salt and initial administrator password. These files are namespace-bound to `drupal` and to the deployment's sealing controller. A different installation must seal its own credentials using the [credentials guide](/admin-guide/secrets/). Preserve existing credentials during restore.

## Bootstrap and verify

Argo CD orders namespace/storage/configuration and sealed credentials before the CNPG cluster, then runs `drupal-install-v2` and `drupal-configure-v2` as ordinary Sync Jobs before the web Deployment and ingress. The configure Job enables Authentik sign-in and seeds the welcome article. PostgreSQL bootstrap enables `pg_trgm`, required by Drupal. The installer creates a Standard-profile site without opening a public installation wizard. Completed Job templates are ignored because Kubernetes makes them immutable.

The initial administrator is `admin`. Retrieve its password through an authorized Secret viewer from `drupal-app`, key `admin-password`, in namespace `drupal`. Do not paste credentials into logs, Git, or documentation. Change the password and administrator email after first login. The sealed initial password does not reset an existing Drupal account.

After publication, inspect each evidence layer separately:

```bash
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n argocd get application drupal
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n drupal get clusters.postgresql.cnpg.io,pods,jobs,pvc,ingress,certificate
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n drupal logs job/drupal-install-v2
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

## Journal theme and React reading tools

The source includes the custom `antalos_journal` theme under `apps/drupal/image/` and a discovery controller in `antalos_blog`. Drupal renders article content, login forms, editorial controls, and the initial journal listing. React enhances isolated mounts; it does not replace Drupal routing or authentication. JavaScript-disabled visitors retain readable articles, title search, sorting, topic links on cards, pagination, and RSS links. The public theme uses the configured Drupal site name; the administration theme remains unchanged.

The design combines warm paper and ink colors, an orange accent, serif headings, a featured latest article, a responsive story grid, and original geometric covers when an article has no image. Dark mode follows the system until the reader chooses an override. The original implementation takes layout inspiration from [Josh Comeau's article index](https://www.joshwcomeau.com/), [Vercel's blog](https://vercel.com/blog), and [Stripe's blog](https://stripe.com/blog); their article copy, branding, and source code are not bundled.

React components provide a keyboard-accessible search dialog (`Ctrl/Cmd K`), title search, topic filters, newest/oldest sorting, pagination, saved articles, theme selection, reading progress, a heading-derived table of contents, larger text, sharing/link copying, code copying, and related articles. Reduced-motion preferences are respected. The saved list stores at most 100 numeric article IDs in browser local storage, with no account synchronization. It queries current published content again, so deleted, unpublished, or inaccessible articles are omitted. A storage failure reports that saving is unavailable. Clipboard failures leave the address bar or selectable code as the fallback. The table of contents appears only when the article contains level-two or level-three headings.

`/journal` serves the page and `/journal/articles` serves bounded JSON pages of 12 articles. Both use published Article nodes, Drupal entity query access checks, per-node view checks, and field view access for excerpts, images, and tags. Search matches titles, not private body fields. Tags come from the configured `field_tags` vocabulary, with up to 50 filter choices. Public `field_image` uploads supply card artwork; private image files are not exposed in card data. Full articles retain Drupal's field formatters and text filtering. Cache metadata includes node/term dependencies, language, query arguments, permissions, and node grants; listings also expire after five minutes.

Publish articles normally in Drupal. Add a body summary for a deliberate deck/excerpt, use Tags for discovery, and add an Image for a cover. The journal lists published articles regardless of the front-page promotion flag. The existing Standard-profile RSS view still uses its own promotion settings; promote posts that should appear in that feed. There is no newsletter signup or delivery service behind this theme. Existing welcome content is preserved; no sample stories or topic terms are inserted.

### Build and activation

The image's Node build stage bundles React, React DOM, and esbuild locally. Their versions and the Node image pin are `DRUPAL_REACT_VERSION`, `DRUPAL_REACT_DOM_VERSION`, `DRUPAL_ESBUILD_VERSION`, and `DRUPAL_NODE_IMAGE_TAG` in `apps/variables.yaml`. Renovate groups React and React DOM together; the image workflow requires matching versions. Only the generated browser bundle and its license notice are copied from the build stage. No Node runtime or third-party script CDN is required in the serving container. Module routing and theme metadata use `.yml.in` source files renamed in the image, keeping them out of Kubernetes manifest rendering.

Publish the configured image tag before reconciling its workload input. The existing installer and OIDC configuration Jobs remain in their original waves. `drupal-theme-v2` is a separate retained Sync Job at wave `3`, after the wave-`1` web Deployment and wave-`2` ingress. It installs and selects the theme only after new web replicas contain its files, sets the front page to `/journal`, places messages/title/local tasks/main content/help blocks, and rebuilds caches. It disables automatically copied block placements without deleting their configuration. The first-run state marker preserves subsequent editorial block/theme/front-page changes on rerun. Theme selection does not modify posts, users, OIDC credentials, or the admin theme.

Completed Jobs do not rerun on image changes. Use a new reviewed Job name and corresponding Application `ignoreDifferences` entry when an asset/routing change needs another cache rebuild. For a theme-only rollback, select the previous theme and front page in Drupal **before** returning to an image without the journal files; their original values are recorded in `antalos_journal.previous_theme` and `antalos_journal.previous_front` state entries. Do not remove the theme's files while it is selected.

This section describes the implementation, not deployment acceptance. Before publication acceptance, separately exercise the image build, Drupal/Twig rendering, anonymous and authenticated access, no-JavaScript content, both color modes at phone/desktop widths, search and pagination, empty topics, saved-list storage failure, article tools, RSS, and existing login/editing flows. The theme and these interactions have not been runtime-validated as part of the source-only redesign.

## References

- [Official Drupal image](https://hub.docker.com/_/drupal)
- [Drupal database requirements](https://www.drupal.org/docs/getting-started/system-requirements/database-server-requirements)
- [CloudNativePG replication](https://cloudnative-pg.io/documentation/current/replication/)

## Authentik OIDC

Publish the derived Drupal image before reconciling the changed workloads. Reconcile Authentik's `drupal-oidc` blueprint and paired sealed credential first, then Drupal. Both namespaces contain an independently sealed copy of the same confidential client secret. Never replace only one side. Increment `AUTHENTIK_DRUPAL_OIDC_REVISION` when rotating it and ensure the blueprint reapplies the changed provider value; rerun the Drupal configure Job and roll the web pods to reload their environment. The blueprint and the secret live under `apps/authentik/`; Drupal configuration stays under `apps/drupal/`.

The provider has application slug `drupal`, client ID `DRUPAL_OIDC_CLIENT_ID`, and the exact callback `https://<DRUPAL_HOST>/openid-connect/generic`. The stable 1.x module uses the `generic` client identifier; its login label is **antID**. Authorization, token and UserInfo endpoints use `AUTHENTIK_HOST`; claims request `openid`, `email` and `profile`. The client secret is an environment-backed settings override, so Drupal configuration exports contain no client secret. Do not put it in the Drupal settings form.

Authenticated access requires verified email and effective membership in `drupal-users`, `drupal-admins`, `antalos-users` or `antalos-admins`. The Authentik blueprint binds the application to those group paths; the existing startup authorization reconciler subsequently discovers the application and adds its normal umbrella relationships. Public blog reading remains anonymous. New SSO identities receive ordinary authenticated Drupal access; only `drupal-admins` or `antalos-admins` grant the Drupal `administrator` role. This role is removed on the next login if those memberships are absent. Already active sessions are not immediately revoked by group changes; revoke sessions separately when removing access urgently.

Automatic linking to an existing email address is disabled. Local Drupal registration is disabled, while permitted OIDC identities can be provisioned on first sign-in. The local UID 1 administrator remains a separate recovery account and SSO login as that account is rejected. Do not link the recovery account. Connect any other existing account explicitly through its authenticated Connected Accounts screen. If the recovery administrator and an Authentik identity share an email address, give the recovery account its own monitored address before provisioning the federated account; do not enable automatic email linking to resolve the collision. Keep the local login form alongside the antID button. The settings override clears the module’s inherited `prompt=login` default, allowing an existing Authentik session to complete SSO without forcing an incompatible second authentication flow.

After deployment, verify an allowed user's redirect, callback, account creation, logout and subsequent login; a forbidden user's denial; and administrator role grant/removal. An actual Authentik browser/token exchange is required to establish working SSO. The source alone does not establish that result.

`drupal-configure-v2` is a retained, ordinary Sync Job. To reapply settings after a reviewed change, introduce a new Job name and matching `ignoreDifferences` entry rather than modifying a completed immutable Job. Configuration is reapplied by that Job; the welcome article is seeded only once. Image changes alone do not rerun completed Jobs.

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

## Recorded deployment acceptance — 2026-11-06

This is separately collected live evidence from the deployed example, not a
continuing health guarantee. Argo CD reported Drupal, Authentik and its own
management application Synced/Healthy. Both Drupal web pods and the two CNPG
instances were ready on separate main workers. PostgreSQL reported the standby
as `streaming` with `sync_state=quorum`. No worker-loss or database-promotion
drill was performed.

Trusted HTTPS returned 200 for the home page, login form and `/welcome`.
Both web replicas independently served the welcome article. A temporary public
file was written as UID:GID `1011:1011`, read from the other web replica, and
retrieved over HTTPS; the acceptance file was then removed.

The OIDC authorization-code callback, server-side token exchange, first
federated account provisioning and administrator access succeeded. Drupal
logout then removed administrator access for that browser session. This used
a short-lived preauthenticated Authentik acceptance session, which was removed
afterward; interactive password entry and MFA were not exercised. Isolated
checks also covered denied groups, unverified email, administrator role
addition/removal, UID 1 protection, repeated setup and preservation of article
edits.

The image publication workflow completed successfully, and its Composer audit
reported no advisories at build time. These checks do not establish backup or
restore readiness; the backup limitation above remains.

## Journal deployment acceptance — 2026-11-12

Separately collected live evidence: the Drupal image workflow completed successfully,
both new web replicas became ready, and `drupal-theme-v1` completed. Argo CD reported
Drupal Synced/Healthy. Public HTTPS returned 200 for the journal home, `/welcome`,
the compiled React bundle, and the article discovery endpoint. Discovery returned
the existing article and returned an empty result for an unmatched title search.
PHP syntax checks passed for the activation script and discovery controller.
The rollout temporarily waited for a worker's DiskPressure scheduling restriction;
it cleared without storage deletion or placement-rule overrides. Browser-rendered
appearance, interactive React controls, and authenticated editing were not exercised
in this deployment acceptance.

### Administration dark appearance

The blog module attaches `css/admin-palette.css` only when Claro is the active
rendering theme. It follows the operating system's dark preference and coordinates
Claro content, form, and Navigation sidebar colors using slate surfaces, muted
borders, and readable blue links. The public journal uses a matching softer slate
palette with its existing theme toggle. Forced-colors mode retains system colors.
A browser extension that recolors pages can still override native styling; the
screenshot's mixed light sidebar/dark content does not establish which browser
setting caused it. These source changes passed PHP syntax, whitespace, and sampled
text-contrast checks; authenticated browser appearance has not yet been verified.
Publishing the updated image and rebuilding Drupal caches is required to activate
the newly attached module library.
