---
title: "Emiliany · Operate"
description: "Build and deploy the Emiliany storefront behind Traefik."
---

The storefront source is in `antblu/emiliany`; Kubernetes resources belong to `apps/emiliany/`. Build and deployment pins, hostname, and demo-mode selection belong to `apps/variables.yaml`.

## Build and publish

Publish the Antalos shared inputs first. The Emiliany repository's `.github/workflows/image.yaml` reads those inputs from Antalos `main`, builds the standalone Next.js server, runs lint, type checking, and the production build, and publishes `ghcr.io/antblu/emiliany`. Pushes and pull requests use a GitHub-hosted Ubuntu runner with Docker and access to both repositories. Manual Run workflow requests can select either `ubuntu-latest` or `self-hosted`. The default token can read the public Antalos repository; if Antalos becomes private, configure a dedicated read token for that checkout.

Successful builds on `main` publish the mutable `main` production channel and a full `sha-<commit>` tag. Pull requests and manual runs on other branches build without publishing. `EMILIANY_IMAGE_TAG: main` selects that channel for deployment; releases no longer require a manual tag increment. GitHub cache export is best effort. The GHCR package is private. `registry.yaml` supplies the namespace-scoped `emiliany-registry` SealedSecret, and `service-account.yaml` attaches it as an image pull Secret to the namespace default ServiceAccount. New pods receive that reference at admission. Keep registry credentials valid and reseal replacements to the same namespace/name; never store the plaintext Docker configuration in Git. Never bake local `.env` files or credentials into the image.

The canonical URL and allowed Medusa image origin are build arguments derived from the shared hostnames. Changing either requires rebuilding the image. Server runtime values are declared on the Deployment. The first deployment retains demo commerce and disabled Google sign-in; publishing the website does not activate checkout, payments, or customer OAuth. Enabling real commerce requires a Store API publishable key, working Medusa regions/catalog, and publicly reachable media URLs; see [Medusa operations](/admin-guide/medusa/).

## Self-hosted builds

The manual runner choice enables either runner type without duplicating builds. A selected self-hosted job queues until its repository-specific listener is available; GitHub does not treat hosted and self-hosted labels as interchangeable alternatives. Default automated builds use hosted runners to avoid the earlier 24-hour queue failure.

The existing `AnthonyPC` runner is registered only to Antalos. To use the same machine for Emiliany, install and register a second listener with a separate work directory against `antblu/emiliany`, preserving the Antalos runner. See [shared runner setup notes](/admin-guide/docs/#runner-selection). The workflow option alone does not register that listener.

## Automatic website updates

The shared `apps/website-image-refresh/` CronJob checks the selected image tag's GHCR digest every minute. A changed digest updates only the Deployment pod-template annotation `images.antblu.net/published-image`, triggering the existing one-at-a-time rollout. `imagePullPolicy: Always` ensures replacements resolve the published image. Unchanged digests do not restart pods. Registry failures leave the Deployment untouched and retry on the next schedule. Allow one polling interval plus rollout time; rapid publications can supersede intermediate builds.

The service-owned `image-refresh-rbac.yaml` grants the shared ServiceAccount `get`/`patch` on only `deployment/emiliany` and `get` on only `secret/emiliany-registry`. It reuses the existing pull credentials in memory; no new registry credentials or cluster credentials are stored in GitHub. Argo CD ignores only the controller's annotation, with `RespectIgnoreDifferences=true`, while retaining source ownership of the actual image tag and other Deployment fields. Renovate does not pin this production channel to a digest.

For initial activation, publish the Emiliany workflow change and complete a successful `main` build **before** publishing Antalos' switch from `0.1.0-1` to `main`. The workflow publishes `main` independently of the currently deployed tag, so it can bootstrap against the old shared inputs. Then publish the shared refresh Application, both service RBAC files, the Application ignore rules, and shared inputs. Uncommitted edits do not activate this path. See [docs operations](/admin-guide/docs/#automatic-website-updates) for the shared Job diagnostics. Check both the Job and `kubectl rollout status` before testing public pages.

## Runner queue timeout

Run [40021178845](https://github.com/antblu/emiliany/actions/runs/40021178845) was cancelled on October 24, 2026 after waiting 24 hours for a self-hosted runner. Its check annotation reported `The job has exceeded the maximum execution time while awaiting a runner for 24h0m0s`; no build steps executed and no runner was assigned. At diagnosis, the Emiliany repository had no registered self-hosted runners. Antalos had a separate runner named `AnthonyPC`, online and busy; a repository runner is not shared automatically with Emiliany. This was a scheduling failure before checkout or Docker compilation. The checked-in workflow defaults to a GitHub-hosted runner to remove that dependency and a 45-minute execution limit once it starts. A successful new build still needs to be verified after publishing the workflow.

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

Roll back by selecting a retained `sha-<commit>` image tag in shared inputs. To freeze a specific digest, use `main@sha256:<digest>`; the refresh Job skips digest-pinned images. Returning to `main` resumes automatic channel updates. There is no storefront PVC to restore; customer/cart/order data and credentials belong to Medusa and its recovery plan. Two replicas with hard hostname anti-affinity, a disruption budget, and a one-at-a-time rollout protect the serving tier when both workers have capacity. DNS, Cloudflare, edge proxies, ingress, and backend dependencies retain their separate failure limits.

[Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting) and [Traefik Ingress routing](https://doc.traefik.io/traefik/reference/routing-configuration/kubernetes/ingress/) describe the upstream behavior used here.

## Private image pull failures

If the public endpoint returns HTTP 503 with `no available server`, inspect pod events before changing ingress or DNS. `ImagePullBackOff` with a GHCR anonymous-token 401 means the pods cannot authenticate to the private image. Confirm the SealedSecret is Synced and the default ServiceAccount references `emiliany-registry`. Pods created before that ServiceAccount configuration need a controlled Deployment restart to receive the pull Secret.

The certificate is independent: a DNS-01 challenge marked Presented but awaiting propagation can remain pending while recursive DNS caches expire. Inspect its status and public TXT answers; successful image pulls do not establish certificate readiness.
