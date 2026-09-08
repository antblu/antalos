---
title: "SuiteCRM \u00b7 Deployment and Admin Guide"
description: "Deploy SuiteCRM with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="SuiteCRM guide sections"><a href="/user-guide/suitecrm/">Overview and User Guide</a><a href="/infrastructure/suitecrm/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/suitecrm/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/suitecrm/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Deploy MariaDB CRDs, the MariaDB operator, OpenEBS, NFS CSI, ingress, and cert-manager first. Set `SUITECRM_*` variables.

2. Prepare the NFS export for the web image’s runtime identity. Preserve the predeclared Galera PVCs and node placement in `storage.yaml`.

3. Reseal database, application, S3, SAML, and registry credentials. Build/publish the custom image in `apps/suitecrm/image/` when changing the packaged release or configuration.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application suitecrm

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n suitecrm get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

SuiteCRM is configured for SAML, not OIDC. Create an Authentik SAML provider for the SuiteCRM origin and use SuiteCRM’s service-provider metadata to obtain its ACS URL and bindings. Match `SAML_SP_ENTITY_ID`, the Authentik metadata/SSO URLs, and the username mapping `http://schemas.goauthentik.io/2021/02/saml/username`. Seal the IdP certificate, SP certificate, and SP private key in `suitecrm-saml`. Assertions must be signed under the checked-in settings. New-account creation is enabled; constrain provider access and assign CRM roles after provisioning.

## 4. Connect and operate the service

1. Let `suitecrm-bootstrap` finish before using the application. Log in as both administrator and ordinary user and confirm record visibility.

2. Configure outbound email and any inbound mailbox processing. Confirm scheduled jobs and the messenger worker process queued work.

3. Inspect the daily physical backup status and rehearse database plus NFS restoration together.

## 5. Maintain and recover

Back up MariaDB and the NFS application data together, including uploaded files and custom configuration. Preserve the SAML service-provider key and identity-provider certificate. The `PhysicalBackup` resource covers the database; it does not itself back up NFS.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

For database startup failures, inspect Galera quorum, PVC placement, and arbitrator compatibility. NFS permission errors need export-side ownership analysis; recursively changing ownership on populated shared storage can be disruptive. SAML failures require checking assertion signatures, entity IDs, and username mapping.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/app.yaml)
- [`backup.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/backup.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/database.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/secrets.yaml)
- [`storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/storage.yaml)
- [`suitecrm.yaml`](https://github.com/antblu/antalos/blob/main/apps/suitecrm/suitecrm.yaml)

[Official SuiteCRM documentation](https://docs.suitecrm.com/user/).
