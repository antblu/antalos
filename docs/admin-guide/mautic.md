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
mail before completing that setup. No SSO or SMTP credentials are provisioned here.

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
