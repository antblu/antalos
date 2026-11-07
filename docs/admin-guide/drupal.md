---
title: "Drupal · Operate"
description: "Deploy Drupal with shared NFS files and a two-instance CloudNativePG database."
---

The source in `apps/drupal/` defines two Drupal web replicas, one PostgreSQL primary and one streaming standby managed by CloudNativePG, and a retained NFS volume. It does not establish current workload health. Follow the [shared deployment workflow](/admin-guide/deploy-an-application/) to publish reviewed source and let Argo CD discover the Application.

## Prepare dependencies

Install CloudNativePG, OpenEBS local storage, the NFS CSI driver, Sealed Secrets, Traefik, and cert-manager first. Both main workers need capacity for PostgreSQL. DNS must route `DRUPAL_HOST` to ingress. The service owns its `letsencrypt-prod` Certificate.

Set the `DRUPAL_*` inputs in `apps/variables.yaml`: image pins, hostname, site name, administrator email, NFS server/export, UID/GID, and volume capacities. The NFS export must already exist and allow UID:GID `DRUPAL_UID:DRUPAL_GID` to create directories. No startup script changes export ownership. The pod sets `fsGroup` to the configured GID so local sites volumes are writable, with `OnRootMismatch`; the NFS CSI driver can adjust volume group permissions when the export root does not match. Prepare export ownership and group permissions before reconciliation to avoid a recursive ownership pass. PostgreSQL uses independent `openebs-local` volumes; do not put its data directory on the shared Drupal export. The NFS capacity is a Kubernetes binding value, not a server-side quota.

`drupal-db-secret.yaml` seals the database owner username/password; `drupal-app-secret.yaml` seals a persistent hash salt and initial administrator password. These files are namespace-bound to `drupal` and to the deployment's sealing controller. A different installation must seal its own credentials using the [credentials guide](/admin-guide/secrets/). Preserve existing credentials during restore.

## Bootstrap and verify

Argo CD orders namespace/storage/configuration and sealed credentials before the CNPG cluster, then runs `drupal-install-v1` as an ordinary Sync Job before the web Deployment and ingress. PostgreSQL bootstrap enables `pg_trgm`, required by Drupal. The installer creates a Standard-profile site without opening a public installation wizard. Completed Job templates are ignored because Kubernetes makes them immutable.

The initial administrator is `admin`. Retrieve its password through an authorized Secret viewer from `drupal-app`, key `admin-password`, in namespace `drupal`. Do not paste credentials into logs, Git, or documentation. Change the password and administrator email after first login. The sealed initial password does not reset an existing Drupal account.

After publication, inspect each evidence layer separately:

```bash
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n argocd get application drupal
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n drupal get cluster,pods,jobs,pvc,ingress,certificate
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

The image supplies Drupal core and its dependencies. Additional modules/themes require a reviewed derived image built with Composer; live changes to container code are ephemeral. Pin that image through the shared version inputs. Core/module updates can require database updates and cache rebuilds: take a backup, plan maintenance, and follow Drupal's upgrade guidance. The initial install Job is not an automated database upgrade mechanism. Do not roll back an image over a migrated database without a compatible restore plan. Scheduled cron, outbound mail and additional identity integrations are not configured here.

## References

- [Official Drupal image](https://hub.docker.com/_/drupal)
- [Drupal database requirements](https://www.drupal.org/docs/getting-started/system-requirements/database-server-requirements)
- [CloudNativePG replication](https://cloudnative-pg.io/documentation/current/replication/)
