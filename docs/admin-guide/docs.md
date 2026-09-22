---
title: "Antalos documentation · Operate"
description: "Deploy antalos documentation with antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="Antalos documentation guide sections"><a href="/user-guide/docs/">Use</a><a href="/infrastructure/docs/">Architecture</a><a aria-current="page" href="/admin-guide/docs/">Operate</a></nav>

## Prerequisites and inputs

- [`argocd.md`](/admin-guide/argocd/)
- [`cert-manager.md`](/admin-guide/cert-manager/)
- Repository input | `--- | --- | --- | ---` | `HTTP address and certificate` | `ACTIVEPIECES_HOST`, `certificate.yaml` | `PostgreSQL | CNPG operator, `database.yaml`, database host and storage variables | `redis.yaml`, both data hosts and the third Sentinel host | `litestream.yaml`, `backup.yaml` | `NFS CSI driver | `nfs-driver.yaml`, bucket, region, bucket, and access credentials | `config.yaml`, `ac |`,...,1174ch elided,...} hooks unless the caller supports that authentication path. | `33 |`, `34:## Operate and upgrade` | `35:36:Distinguish HTTP availability from queue progress. For a delayed flow, inspect the run state, worker readiness, REDIS discovery, and upstream connection. For an uncertain action, check the destination before replaying it.` | `37:38:Review release-specific migration requirements before changing ACTIVEPIECES_IMAGE_TAG. App and worker roles use the same image tag. Keep the database, file objects, and original secrets recoverable before an upgrade, and confirm representative flows after it.`

## Deploy antalos documentation

This runbook deploys the service from `apps/docs/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

### 1. Prepare dependencies and inputs

- Read the [site authoring guide](/admin-guide/site-authoring/) for content structure and local development.
- Set `DOCS_HOST`, `DOCS_NODE_IMAGE_TAG`, `DOCS_NGINX_IMAGE_TAG`, and `DOCS_NGINX_IMAGE_TAG`. Build the image before selecting its immutable SHA256.
- ## 2. Reconcile the application
- Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Application.
- ## 3. Exercise the upgraded service
- ## 4. Evidence | What it demonstrates | `--- | --- | --- | --- |` | `TLS and real user transaction | The network and application work together |` | `Data restore drill | Backups and credentials support recovery |` | `Controlled failure drill | The documented failover behavior works within observed timing |` | `75:76:Keep these outcomes separate. A green Argo badge is neither a backup nor a node-loss test.`

## Recover antalos documentation

The documented failover behavior works within observed timing.

## Recovery drill | `73:74:At least periodically:` | `75:76:1. Restore backups into an isolated environment.` | `77:2. Validate that Sealed Secrets decrypt successfully.` | `78:3. Restore a representative PostgreSQL database and inspect its contents.` | `79:4. Retrieve representative objects from Garage S3 and NFS, 80:5. Record recovery time and any undocumented manual step.` | `81:6. Update these runbooks and backup coverage after the drill.` | `82:83:A backup is operationally useful only after a successful restore test.`