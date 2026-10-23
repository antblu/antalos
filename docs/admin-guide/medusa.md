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

The repository's custom OIDC provider in `apps/medusa/image/src/modules/antid/` is registered as `antid`, with display name `antID`. It uses the open-source `openid-client` library through Medusa's custom-provider interface; it does not load Medusa's licensed native OIDC provider. Admin offers both its email/password form and **Continue with antID** for the `user` actor. Existing Medusa local email/password credentials remain usable; Authentik passwords are not copied into Medusa. The custom `/auth/emailpass/user` route rejects public self-provisioning and email-based claiming of administrator accounts; local administrator creation uses invitations or operator provisioning. No custom Admin widget is needed.

Configure the existing Authentik Medusa confidential client with this exact redirect URI (including its query string):

```text
https://medusa.antblu.net/app/login?auth_provider=antid
```

The issuer is `https://auth.antblu.net/application/o/medusa/`; Medusa discovers its authorization, token, and JWKS endpoints from the supplied discovery URL. Shared public values live under `MEDUSA_OIDC_*` in `apps/variables.yaml`. The `medusa-oidc` SealedSecret provides `OIDC_CLIENT_SECRET` to servers, workers, and migrations. An image rebuild is required for this configuration change; the configured release tag is incremented accordingly.

Bind the Authentik application to the identities or groups allowed to administer Medusa. Successful login can create a Medusa administrator automatically, so application access must be limited to store administrators. The custom `/auth/user/antid/callback` handler links an existing administrator when its normalized email matches the Authentik-managed email; otherwise it creates the user. Subsequent identity matching uses the stable OIDC `sub` claim and preserves the associated user ID. Authentik must return a nonempty `email` and stable `sub`, using the `openid email profile` scopes. `MEDUSA_OIDC_REQUIRE_VERIFIED_EMAIL` is explicitly `false`: this deployment trusts email addresses administered by Authentik and does not require the optional `email_verified` claim to be true. This policy also permits linking an existing administrator by that trusted email. Keep Authentik account/email administration and the Medusa application bindings restricted. The provider defaults to requiring verified email when this option is absent or set to `true`. First login does not require a separately bootstrapped local password.

The provider uses authorization code with S256 PKCE, nonce validation, issuer/audience/expiry checks, and JWKS signature verification. It accepts only the configured callback URL. Discovery is lazy, so building the image requires neither IdP access nor a client secret; authentication requires the runtime `OIDC_CLIENT_SECRET`. OAuth state expires after ten minutes and is consumed on callback through the Sentinel-backed legacy Redis cache required by the Auth module, alongside the existing modern caching provider, so a callback can reach a different server pod. The callback uses Medusa's token-generation helper to retain verification and MFA checks. Losing Redis state during failover may require restarting login. Logging out of Medusa does not establish that the Authentik browser session has ended.

After publishing and deployment, verify that `/auth/user/providers` advertises `antid` with display name `antID`, the Admin button redirects to Authentik with the exact callback, and a permitted user returns to Admin successfully. Confirm that an identity denied by the Authentik application policy cannot sign in. An external interactive login is still required after deploying a changed image to prove the complete user transaction.

## Google customer login

The storefront's Google sign-in uses Medusa's Google auth provider directly for the `customer` actor. The `user` actor remains limited to `emailpass` and `antid`; a Google customer login cannot provision an Admin user. Customers can still use email/password.

1. In Google Cloud, create a **Web application** OAuth client and allow `https://emiliany.com/api/auth/google/callback` as its exact authorized redirect URI. Complete any Google consent-screen requirements for the intended audience.
2. Seal a `medusa-google` Secret in namespace `medusa` with keys `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, using the `sealed-secrets-controller` controller in namespace `sealed-secrets`. Keep the plaintext inputs outside Git. The Secret references in the server, worker, and migration workloads are optional so an unconfigured installation remains startable; the provider registers only when both values exist.
3. Publish the new backend image tag and reconcile the Medusa Application. Restart the server and worker pods after adding or rotating the optional Secret because environment variables are read at process start.
4. In the Emiliany deployment, set `COMMERCE_DEMO_MODE=false`, configure a real Medusa publishable key, and set `GOOGLE_CUSTOMER_LOGIN_ENABLED=true` only after the provider is available. The storefront callback is server-side and writes the existing HttpOnly customer session cookie.

On first successful Google callback, the storefront creates the Medusa customer through the authenticated Store API and refreshes the token so it has a customer actor ID. Later Google logins reuse that identity. An existing email/password customer with the same email requires an explicit authenticated provider-linking flow; Google email alone must not claim that account. Verify first login, repeat login, `/store/customers/me`, and the existing Admin sign-in separately. An uncommitted image/configuration edit or a redirect to Google is not proof of a working customer session.

### Login returns to Admin and fails with HTTP 401

A successful Authentik token exchange does not mean Medusa accepted the identity. Compare both server replicas' callback logs with Authentik's token-endpoint status. The callback preserves the provider's credential-free failure message, including expired state, missing claims, and an unmet verified-email requirement.

On 2026-10-22, live failed logins had a successful Authentik token exchange but `email_verified: false`. The prior provider rejected those claims. The configured trust policy above permits these Authentik-managed addresses while retaining token signature, issuer, audience, expiry, PKCE, nonce, and state checks. Changing that policy requires publishing the configured backend image and reconciling the ConfigMap; source changes alone do not repair the deployed service.

## Odoo catalog integration

The custom `odoo` module, `sync-from-odoo` workflow, and daily worker job follow [Medusa's Odoo recipe](https://docs.medusajs.com/resources/recipes/erp/odoo). Native Node `fetch` implements the same JSON-RPC protocol without another client dependency. The module uses Odoo 19's standard `search_read`/`read`, `default_code`, and `product_template_attribute_value_ids`, avoiding optional/custom fields in the recipe. [Odoo documents this RPC transport as deprecated](https://www.odoo.com/documentation/19.0/developer/reference/external_rpc_api.html); plan a transport migration before upgrading to a release that removes it.

This integration reads the catalog from Odoo into Medusa. It does not export orders or customers, import images, synchronize stock, map taxes, or evaluate customer pricelists. Prices use Odoo's `lst_price`, including variant extras, in the product's currency and Medusa v2 major units. Review tax inclusion and accepted currencies before selling imported products.

### Provision the integration identity

Odoo must have the product catalog models installed, for example through Sales or Inventory, before synchronization can run. Account/key provisioning can precede that installation: the tool reports missing models and defers their read ACLs. It does not install or upgrade Odoo modules against serving replicas. Keep sync disabled while any required model is missing.

From the repository root, with cluster access, run this explicit account/key creation operation:

```bash
python3 apps/medusa/tools/provision-odoo-integration.py
```

The tool creates `medusa-integration` and the **Medusa Catalog Reader** group. The account has no password and belongs only to this group, with read ACLs for installed product, variant, attribute, currency, company, and unit-of-measure models. It receives no Internal User, administrator, Sales, or Inventory role, and uses the Odoo shell's current company. Existing company record rules apply. Effective create/write/delete permissions on those installed models are rejected before issuing a key. This account is separate from Authentik JIT provisioning.

After installing missing catalog modules through a separately planned Odoo maintenance operation, reconcile their read ACLs without generating or rotating the API key:

```bash
python3 apps/medusa/tools/provision-odoo-integration.py --reconcile-access
```

On **2026-10-23 (America/Denver)**, provisioning created this dedicated account and persistent RPC key and wrote the local SealedSecret. Product templates, variants, attribute models, and units of measure were absent, so only the installed currency/company models received read ACLs. The credential was not deployed, sync remained disabled, and no product synchronization was performed.

It generates a persistent RPC-scoped API key and writes only encrypted values to `apps/medusa/odoo-secret.yaml`. The SealedSecret is bound to namespace `medusa`, name `medusa-odoo`, keys `ODOO_USERNAME` and `ODOO_API_KEY`, using `sealed-secrets-controller` in namespace `sealed-secrets`. Plaintext credentials cross only process pipes and memory. The public sealing certificate is fetched before creating the account; do not enable tracing or print captured subprocess output.

Provisioning refuses to overwrite a sealed file, claim an unrelated login, or rotate an existing API key. Odoo external IDs under `medusa_integration` identify its group and user. If Odoo commits a key but sealing subsequently fails, inspect the dedicated account's API-key list privately and deliberately revoke the unusable key before retrying. Do not rotate credentials on pod startup. Back up Odoo's identity/ACL/key-hash state and the SealedSecret with the sealing recovery material. To rotate, deliberately revoke the old key, retain the old sealed file as protected recovery material if needed, generate/seal its replacement, publish it, and restart both Medusa Deployments after reconciliation. Sync is interrupted until the replacement is loaded.

### Activate and operate

`MEDUSA_ODOO_SYNC_ENABLED` defaults to `false` in `apps/variables.yaml`. `medusa-env` derives `ODOO_URL` from `ODOO_HOST` and `ODOO_DB_NAME` from `ODOO_DATABASE_NAME`. Servers, workers, and migrations reference the optional `medusa-odoo` Secret. Disabled integrations make no Odoo requests; enabling without all credentials fails startup. Module construction does not contact Odoo.

1. Provision the account and sealed credential. Prepare the Medusa store's default sales channel, a default shipping profile, and supported currencies; the integration creates none of these implicitly.
2. Build and publish the configured immutable backend image. Publish the SealedSecret and set the enable flag to `true`, following the normal Argo migration and rollout waves. Account creation alone does not deploy or activate sync.
3. The worker job runs daily at **00:00 UTC**, with the container's default UTC timezone (18:00 Denver daylight time or 17:00 standard time on the preceding day). For an immediate run, send an authenticated administrator `POST` with an empty body to `https://medusa.antblu.net/admin/odoo/sync`. Normal Medusa Admin authentication applies. The response reports `synced`; scheduled runs log start/completion counts. Large manual runs may outlast an HTTP proxy timeout; inspect workflow/worker state before retrying.
4. When checks are explicitly requested, verify authentication and read-only permissions, run a sync, compare IDs, options, prices, currencies, and publication status, and repeat it to confirm stable Medusa IDs. Assign inventory and media before testing a real storefront transaction. Readiness alone does not prove synchronization.

Templates, including archived templates, are scanned in ascending ID batches of 50. Product `external_id` is `odoo:product.template:<id>` with `metadata.odoo_template_id`; variants use `metadata.odoo_variant_id`. These IDs retain associations when SKUs change. Missing SKUs receive `odoo-variant-<id>`. Existing unlinked Medusa products are not adopted by matching a title or SKU. Newly created handles contain the template ID and initial name; later syncs preserve handles, categories, images, shipping profiles, sales-channel assignments, and unrelated metadata.

Odoo owns names, sale descriptions, SKUs, catalog prices, and publication status when the optional `is_published` field exists. Without that field, new imports are drafts and subsequent syncs preserve Medusa publication status. Archived or non-saleable templates become drafts. New variants enable inventory management and disallow backorders; assign Medusa inventory before sale. Existing inventory settings and quantities remain under Medusa control.

Removed variants, renamed options, or new option values on existing products stop the batch for explicit reconciliation in Medusa, avoiding silent deletion of inventory relationships. New variants using existing option definitions can be added. Deleted or newly inaccessible templates are not deletion instructions; previously imported products require explicit reconciliation. SKU conflicts and inaccessible attributes fail rather than merging another product.

Manual and scheduled runs share the existing Redis-backed, renewed distributed lock. A competing run fails to acquire it. Standard Medusa workflows provide compensation per batch; earlier completed batches remain after a later failure. A full rerun converges by external IDs. Redis failover can lose locks, and concurrent Odoo edits may require another run; this is neither exactly-once processing nor a cross-system snapshot. Disable the flag and roll the processes to stop future runs without deleting imported products. This describes source behavior; activation and end-to-end results require separate runtime evidence.

## Recovery and failure drills

Confirm that CNPG routes `medusa-db-rw` to the current primary and that all Sentinels agree on one Redis master. Returning Redis members must follow that master. Check replication catch-up before declaring redundancy restored. Do not reset the PVCs to repair a role discrepancy.

Before a controlled worker-loss drill, obtain approval for the disruptive action. Prove an authenticated write and read plus a background job across promotion, then test the original primary's return. Check S3 from Medusa using a dedicated test object; do not delete user objects. Store backup and restore evidence separately from the source-design claims.

The storefront is deferred. Set `STORE_CORS` and extend `AUTH_CORS` only when its actual origin is known. Configure and verify an externally reachable media URL and appropriate object read policy before relying on browser images. See the [availability limits](/infrastructure/medusa/#availability-and-recovery).
