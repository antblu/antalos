---
title: "Emiliany · Operate"
description: "Build and deploy the Emiliany storefront behind Traefik."
---

The storefront source is in `antblu/emiliany`; Kubernetes resources belong to `apps/emiliany/`. Build and deployment pins, hostname, and demo-mode selection belong to `apps/variables.yaml`.

## Build and publish

Publish the Antalos shared inputs first. The Emiliany repository's `.github/workflows/image.yaml` reads those inputs from Antalos `main`, builds the standalone Next.js server, runs lint, type checking, and the production build, and publishes `ghcr.io/antblu/emiliany`. Its self-hosted runner needs Docker and access to both repositories. The default token can read the public Antalos repository; if Antalos becomes private, configure a dedicated read token for that checkout.

Increment `EMILIANY_IMAGE_TAG` for each release before building; do not overwrite an already deployed release tag. The workflow also publishes a full `sha-<commit>` tag. Make the GHCR package publicly readable before reconciliation, or add a service-owned sealed registry credential and `imagePullSecrets` before deploying a private package. Never bake local `.env` files or credentials into the image.

The canonical URL and allowed Medusa image origin are build arguments derived from the shared hostnames. Changing either requires rebuilding the image. Server runtime values are declared on the Deployment. The first deployment retains demo commerce and disabled Google sign-in; publishing the website does not activate checkout, payments, or customer OAuth. Enabling real commerce requires a Store API publishable key, working Medusa regions/catalog, and publicly reachable media URLs; see [Medusa operations](/admin-guide/medusa/).

## Reconcile and expose

Publish `apps/emiliany/` and shared inputs on Antalos `main`. The root app-of-apps discovers the Application automatically. Local uncommitted edits cannot reach Argo CD.

The public HTTPS path must forward `emiliany.com` to Traefik's ingress address. Preserve the existing DNS/edge ownership; a Kubernetes Ingress does not change Cloudflare DNS or origin settings. `letsencrypt-prod` uses Cloudflare DNS-01 and its token must cover the `emiliany.com` zone. Port 80 is not exposed by the current Traefik Service, so HTTP redirects require separate edge configuration. The route covers the apex hostname only.

## Verify deployment

From the Antalos root:

```bash
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n argocd get application emiliany
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n emiliany get deployment,pods,svc,ingress,certificate,pdb
curl --fail https://emiliany.com/api/health
```

Confirm the intended Git revision is Synced, both pods are ready on different workers, the certificate is Ready, and public pages and their CSS/JavaScript load. Exercise locale navigation, product pages, cart, and appointment links in a browser. `/api/health` checks the Next.js process only; it does not check Medusa or payments.

## Maintenance and recovery

Both replicas use the same built image and its Server Function encryption key. A build-specific deployment ID helps detect rolling-release version differences. Long-lived sessions across rebuilt images require an intentionally managed stable encryption key if Server Function closures are introduced. Local image/data caches are disposable per-pod `emptyDir` volumes; region reads can differ for their five-minute cache TTL. There is no shared cache invalidation service.

Roll back by restoring the previous published image tag in shared inputs. There is no storefront PVC to restore; customer/cart/order data and credentials belong to Medusa and its recovery plan. Two replicas with hard hostname anti-affinity, a disruption budget, and a one-at-a-time rollout protect the serving tier when both workers have capacity. DNS, Cloudflare, edge proxies, ingress, and backend dependencies retain their separate failure limits.

[Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting) and [Traefik Ingress routing](https://doc.traefik.io/traefik/reference/routing-configuration/kubernetes/ingress/) describe the upstream behavior used here.
