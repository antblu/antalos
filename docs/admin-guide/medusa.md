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

The repository's custom OIDC provider in `apps/medusa/image/src/modules/antid/` is registered as `antid`, with display name `antID`. It uses the open-source `openid-client` library through Medusa's custom-provider interface; it does not load Medusa's licensed native OIDC provider. Admin offers **Continue with antID** and accepts only this provider for the `user` actor. The email/password provider remains available only to customers. No custom Admin widget is needed.

Configure the existing Authentik Medusa confidential client with this exact redirect URI (including its query string):

```text
https://medusa.antblu.net/app/login?auth_provider=antid
```

The issuer is `https://auth.antblu.net/application/o/medusa/`; Medusa discovers its authorization, token, and JWKS endpoints from the supplied discovery URL. Shared public values live under `MEDUSA_OIDC_*` in `apps/variables.yaml`. The `medusa-oidc` SealedSecret provides `OIDC_CLIENT_SECRET` to servers, workers, and migrations. An image rebuild is required for this configuration change; the configured release tag is incremented accordingly.

Bind the Authentik application to the identities or groups allowed to administer Medusa. Successful login can create a Medusa administrator automatically, so application access must be limited to store administrators. The custom `/auth/user/antid/callback` handler links an existing administrator when its normalized email matches the Authentik-managed email; otherwise it creates the user. Subsequent identity matching uses the stable OIDC `sub` claim and preserves the associated user ID. Authentik must return a nonempty `email` and stable `sub`, using the `openid email profile` scopes. `MEDUSA_OIDC_REQUIRE_VERIFIED_EMAIL` is explicitly `false`: this deployment trusts email addresses administered by Authentik and does not require the optional `email_verified` claim to be true. This policy also permits linking an existing administrator by that trusted email. Keep Authentik account/email administration and the Medusa application bindings restricted. The provider defaults to requiring verified email when this option is absent or set to `true`. First login does not require a separately bootstrapped local password.

The provider uses authorization code with S256 PKCE, nonce validation, issuer/audience/expiry checks, and JWKS signature verification. It accepts only the configured callback URL. Discovery is lazy, so building the image requires neither IdP access nor a client secret; authentication requires the runtime `OIDC_CLIENT_SECRET`. OAuth state expires after ten minutes and is consumed on callback through the Sentinel-backed legacy Redis cache required by the Auth module, alongside the existing modern caching provider, so a callback can reach a different server pod. The callback uses Medusa's token-generation helper to retain verification and MFA checks. Losing Redis state during failover may require restarting login. Logging out of Medusa does not establish that the Authentik browser session has ended.

After publishing and deployment, verify that `/auth/user/providers` advertises `antid` with display name `antID`, the Admin button redirects to Authentik with the exact callback, and a permitted user returns to Admin successfully. Confirm that an identity denied by the Authentik application policy cannot sign in. An external interactive login is still required after deploying a changed image to prove the complete user transaction.

### Login returns to Admin and fails with HTTP 401

A successful Authentik token exchange does not mean Medusa accepted the identity. Compare both server replicas' callback logs with Authentik's token-endpoint status. The callback preserves the provider's credential-free failure message, including expired state, missing claims, and an unmet verified-email requirement.

On 2026-10-22, live failed logins had a successful Authentik token exchange but `email_verified: false`. The prior provider rejected those claims. The configured trust policy above permits these Authentik-managed addresses while retaining token signature, issuer, audience, expiry, PKCE, nonce, and state checks. Changing that policy requires publishing the configured backend image and reconciling the ConfigMap; source changes alone do not repair the deployed service.

## Recovery and failure drills

Confirm that CNPG routes `medusa-db-rw` to the current primary and that all Sentinels agree on one Redis master. Returning Redis members must follow that master. Check replication catch-up before declaring redundancy restored. Do not reset the PVCs to repair a role discrepancy.

Before a controlled worker-loss drill, obtain approval for the disruptive action. Prove an authenticated write and read plus a background job across promotion, then test the original primary's return. Check S3 from Medusa using a dedicated test object; do not delete user objects. Store backup and restore evidence separately from the source-design claims.

The storefront is deferred. Set `STORE_CORS` and extend `AUTH_CORS` only when its actual origin is known. Configure and verify an externally reachable media URL and appropriate object read policy before relying on browser images. See the [availability limits](/infrastructure/medusa/#availability-and-recovery).
