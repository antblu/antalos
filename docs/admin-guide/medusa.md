---
title: Medusa · Operate
description: Build, deploy, verify, and recover the Medusa backend.
---

<nav class="guide-switcher" aria-label="Medusa guides"><a href="/user-guide/medusa/">Use</a><a href="/infrastructure/medusa/">Architecture</a><a aria-current="page" href="/admin-guide/medusa/">Operate</a></nav>

## Publish and deploy

1. Confirm that the existing Garage `medusa` bucket exists and that its supplied key has read/write access. The manifests neither create nor change that bucket. Keep `medusa-s3`, `medusa-app`, `medusa-db-app`, and `medusa-redis` SealedSecrets in this application's namespace. Preserve all keys on restore.
2. Build and publish the backend/Admin image with `.github/workflows/medusa-image.yaml`. It reads the Node tag, Medusa version, image repository, and release tag from `apps/variables.yaml`. The locked npm dependencies must match `MEDUSA_VERSION`. Keep release tags immutable; increment the image tag for source/configuration changes. Ensure the package is readable by cluster nodes before reconciliation, or configure a pull Secret. Do not include runtime secrets in the image.
3. Publish the application sources and variables to `main`, which the root Argo Application tracks. Argo's rendering plugin discovers `apps/medusa/app.yaml`. Initial reconciliation can wait on the image build; resync once the image is published. Publishing before a successful build can leave Medusa unavailable.
4. Sync respects the declared waves: sealed credentials, CNPG, Redis/configuration, the Sync migration Job, then serving and worker Deployments. Migrations run once per sync before the deployments. They are not a PreSync hook. Existing processes can remain active during later migrations, so review schema compatibility and back up before upgrading.
5. Verify Argo `Synced/Healthy`, two CNPG instances, two Redis data members, three Sentinel voters, and two Ready pods in each Medusa Deployment. Verify certificate readiness and the real HTTPS `/health` and `/app` paths. The built-in `/health` only proves the process finished startup; separately test database writes, authenticated API access, background jobs, and S3 upload/download.

The expected backend hostname is `medusa.antblu.net`. DNS and edge routing must reach the shared Traefik ingress; a Certificate or Ingress alone does not prove reachability.

## First administrator

No default administrator or password is baked into the source. Bootstrap an administrator using the official `medusa user` command in a server pod. Run from the repository root, select a Ready server pod, and supply an administrator email and a unique password through a protected interactive terminal. Do not put those credentials in documentation, command transcripts, or shared variables. See [Medusa user CLI](https://docs.medusajs.com/resources/medusa-cli/commands/user).

## Recovery and failure drills

Confirm that CNPG routes `medusa-db-rw` to the current primary and that all Sentinels agree on one Redis master. Returning Redis members must follow that master. Check replication catch-up before declaring redundancy restored. Do not reset the PVCs to repair a role discrepancy.

Before a controlled worker-loss drill, obtain approval for the disruptive action. Prove an authenticated write and read plus a background job across promotion, then test the original primary's return. Check S3 from Medusa using a dedicated test object; do not delete user objects. Store backup and restore evidence separately from the source-design claims.

The storefront is deferred. Set `STORE_CORS` and extend `AUTH_CORS` only when its actual origin is known. Configure and verify an externally reachable media URL and appropriate object read policy before relying on browser images. See the [availability limits](/infrastructure/medusa/#availability-and-recovery).
