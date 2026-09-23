---
title: Activepieces · Operate
description: Deploy the automation service and complete its credentials, storage, workers, and connected accounts.
---

<nav class="guide-switcher" aria-label="Activepieces guides"><a href="/user-guide/activepieces/">Use</a><a href="/infrastructure/activepieces/">Architecture</a><a aria-current="page" href="/admin-guide/activepieces/">Operate</a></nav>

Follow the [shared application workflow](/admin-guide/deploy-an-application/) and the [official installation documentation](https://www.activepieces.com/docs/install/overview). antalos deploys custom manifests from `apps/activepieces/` rather than invoking the upstream quick installer.

## Prerequisites and inputs

| Requirement | Repository input |
| --- | --- |
| HTTP address and certificate | `ACTIVEPIECES_HOST`, `certificate.yaml` |
| PostgreSQL | CNPG operator, `database.yaml`, database host and storage variables |
| Redis discovery | `redis.yaml`, both data hosts and the third Sentinel host |
| Files | Garage endpoint, region, bucket, and access credentials |
| App and worker configuration | `config.yaml`, `activepieces.yaml`, and sealed `activepieces-config` |
| Browser access | Authentik single-application forward-auth provider for `https://flows.antblu.net` |
| Eligible capacity | Both main workers, plus the RTX Sentinel placement |

Read every Secret key consumed by the configuration and deployments. The PostgreSQL bootstrap owner and application password must agree. Preserve encryption secrets when retaining an existing database. Keep new credentials sealed in this service directory.

## Deployment sequence

1. Prepare the external bucket and scoped access, DNS, and certificate prerequisites. In Authentik, create an Activepieces application with a Proxy Provider in **Forward auth (single application)** mode. Set **External host** to `https://flows.antblu.net`, assign it to the embedded outpost, and bind the intended users or groups.
2. Set the application inputs for your environment and supply the matching SealedSecret.
3. Reconcile the Application through the normal Git publishing workflow. Follow its resource waves for configuration, database, Redis, and serving roles.
4. Establish the first administrator and the intended user/workspace access through the installed product.
5. Authorize connected accounts and configure any required upstream callbacks or webhook senders.
6. Run a small flow through a real trigger, inspect the worker result, and confirm the destination changed as intended.

Traefik sends browser and API requests through the shared Authentik forward-auth middleware. Its higher-priority `/outpost.goauthentik.io/` route serves the authentication callback without that middleware. Incoming `/api/v1/webhooks/` requests also bypass interactive authentication so external triggers can reach Activepieces; treat each webhook URL as a public capability and configure verification in the trigger where supported. Authentik admission does not create an Activepieces account or grant workspace permissions. Keep application authorization configured separately.

After reconciliation, check an anonymous browser redirect, an allowed and a denied Authentik identity, the callback path, an Activepieces login, and a real incoming webhook. The Kubernetes route alone does not create the Authentik provider or prove that those requests work.

## Operate and upgrade

Distinguish HTTP availability from queue progress. For a delayed flow, inspect the run state, worker readiness, Redis discovery, and upstream connection. For an uncertain action, check the destination before replaying it.

Review release-specific migration requirements before changing `ACTIVEPIECES_IMAGE_TAG`. App and worker roles use the same image input. Keep the database, file objects, and original secrets recoverable before an upgrade, and confirm representative flows after it.

Use the [architecture guide](/infrastructure/activepieces/) for replica and failure limits, and [Activepieces documentation](https://www.activepieces.com/docs/overview/welcome) for product administration.
