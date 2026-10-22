---
title: Medusa · Operate
description: Build, deploy, verify, and recover the Medusa backend.
---

<nav class="guide-switcher" aria-label="Medusa guides"><a href="/user-guide/medusa/">Use</a><a href="/infrastructure/medusa/">Architecture</a><a aria-current="page" href="/admin-guide/medusa/">Operate</a></nav>

## Publish and deploy

1. Confirm that the existing Garage `medusa` bucket exists and that its supplied key has read/write access. The manifests neither create nor change that bucket. Keep `medusa-s3`, `medusa-app`, `medusa-db-app`, `medusa-redis`, and `medusa-oidc` SealedSecrets in this application's namespace. Preserve all keys on restore.
2. Build and publish the backend/Admin image with `.github/workflows/medusa-image.yaml`. It reads the Node tag, Medusa version, image repository, and release tag from `apps/variables.yaml`. The locked npm dependencies must match `MEDUSA_VERSION`. Keep release tags immutable; increment the image tag for source/configuration changes. Ensure the package is readable by cluster nodes before reconciliation, or configure a pull Secret. Do not include runtime secrets in the image.
3. Publish the application sources and variables to `main`, which the root Argo Application tracks. Argo's rendering plugin discovers `apps/medusa/app.yaml`. Initial reconciliation can wait on the image build; resync once the image is published. Publishing before a successful build can leave Medusa unavailable.
4. Sync respects the declared waves: sealed credentials, CNPG, Redis/configuration, the Sync migration Job, then serving and worker Deployments. Migrations run once per sync before the deployments. They are not a PreSync hook. Existing processes can remain active during later migrations, so review schema compatibility and back up before upgrading.
5. Verify Argo `Synced/Healthy`, two CNPG instances, two Redis data members, three Sentinel voters, and two Ready pods in each Medusa Deployment. Verify certificate readiness and the real HTTPS `/health` and `/app` paths. The built-in `/health` only proves the process finished startup; separately test database writes, authenticated API access, background jobs, and S3 upload/download.

The expected backend hostname is `medusa.antblu.net`. DNS and edge routing must reach the shared Traefik ingress; a Certificate or Ingress alone does not prove reachability.

## antID administrator login

Medusa 2.22's native OIDC provider is registered as `antid`, with display name `antID`. Admin offers **Continue with antID** and accepts only this provider for the `user` actor. The email/password provider remains available only to customers. No custom Admin widget is needed.

Configure the existing Authentik Medusa confidential client with this exact redirect URI (including its query string):

```text
https://medusa.antblu.net/app/login?auth_provider=antid
```

The issuer is `https://auth.antblu.net/application/o/medusa/`; Medusa discovers its authorization, token, and JWKS endpoints from the supplied discovery URL. Shared public values live under `MEDUSA_OIDC_*` in `apps/variables.yaml`. The `medusa-oidc` SealedSecret provides `OIDC_CLIENT_SECRET` to servers, workers, and migrations. An image rebuild is required for this configuration change; the configured release tag is incremented accordingly.

Bind the Authentik application to the identities or groups allowed to administer Medusa. Successful login can create a Medusa administrator automatically, so application access must be limited to store administrators. The native provisioning flow links an existing administrator when its email matches the IdP-verified email; otherwise it creates the user. Subsequent identity matching uses the stable OIDC `sub` claim. Authentik must return a nonempty `email` with `email_verified: true`, using the `openid email profile` scopes. First login does not require a separately bootstrapped local password.

The provider uses authorization code with S256 PKCE and nonce validation, and an exact callback allowlist. OAuth state is held in the Sentinel-backed legacy Redis cache required by the Auth module, alongside the existing modern caching provider, so a callback can reach a different server pod. Losing Redis state during failover may require restarting login. Logging out of Medusa does not establish that the Authentik browser session has ended.

After publishing and deployment, verify that `/auth/user/providers` advertises `antid` with display name `antID`, the Admin button redirects to Authentik with the exact callback, and a permitted user returns to Admin successfully. Confirm that an identity denied by the Authentik application policy cannot sign in. These checks and interactive login have not been performed for this source change.

## Recovery and failure drills

Confirm that CNPG routes `medusa-db-rw` to the current primary and that all Sentinels agree on one Redis master. Returning Redis members must follow that master. Check replication catch-up before declaring redundancy restored. Do not reset the PVCs to repair a role discrepancy.

Before a controlled worker-loss drill, obtain approval for the disruptive action. Prove an authenticated write and read plus a background job across promotion, then test the original primary's return. Check S3 from Medusa using a dedicated test object; do not delete user objects. Store backup and restore evidence separately from the source-design claims.

The storefront is deferred. Set `STORE_CORS` and extend `AUTH_CORS` only when its actual origin is known. Configure and verify an externally reachable media URL and appropriate object read policy before relying on browser images. See the [availability limits](/infrastructure/medusa/#availability-and-recovery).
