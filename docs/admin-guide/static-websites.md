---
title: Publish a static website
description: GitHub Actions, GHCR, Argo CD, and HTTPS delivery for a buildless website.
---

`apps/antblu/` provides a static website deployment example. Website content and the image workflow belong in the separate website repository; Antalos owns the Kubernetes resources and shared `ANTBLU_*` inputs in `apps/variables.yaml`.

The website image copies static files into unprivileged NGINX listening on port 8080. Two replicas use required hostname anti-affinity, a read-only root filesystem, and a writable temporary directory. The Service selects ready pods; the PodDisruptionBudget retains one during voluntary eviction. Zero surge and one unavailable replica permit replacement within existing worker capacity. Availability still depends on ingress, DNS, the cluster, and registry access during replacement. There is no serving database or persistent volume.

## Publish

1. Set the hostname, image repository, production tag, and NGINX build version in the shared inputs. Publish those inputs and `apps/antblu/` through Antalos main. The root Application discovers the service Application.
2. Ensure the website files are actually tracked in its remote repository. An embedded Git repository recorded only as a gitlink without a usable submodule URL cannot supply files to GitHub Actions.
3. Publish the website Dockerfile, NGINX configuration, and build workflows. Main builds publish the production channel and a commit tag to GHCR. Pull requests build without publishing. Allow Actions to write the package. The example deployment and digest refresher use anonymous pulls, so the package must be public before rollout. For private images, provision a service-owned SealedSecret, attach its pull credentials, and scope refresher Secret access like other private websites.
4. Create the public DNS record pointing to the existing HTTPS edge. Preserve unrelated records, including mail records. An Ingress and Certificate do not create that record. cert-manager uses the existing `letsencrypt-prod` issuer for the declared hostname.
5. Check Argo reconciliation, certificate readiness, Deployment readiness, pod placement, and public HTTPS separately. Fetch `/`, `/healthz`, and referenced assets; confirm the expected content. A healthy health endpoint alone does not prove the intended website was packaged.

The shared image refresher polls the production image digest every minute. Service-scoped RBAC permits it to get and patch only the named Deployment. Argo ignores only its published-image annotation. Image updates roll independently of source synchronization. Select a retained commit tag for rollback; a digest-pinned image disables automatic refresh.

This page describes source configuration, not evidence that a particular website is live. See the [NGINX unprivileged image documentation](https://github.com/nginx/docker-nginx-unprivileged) for runtime constraints and the [documentation deployment guide](/admin-guide/docs/) for the shared image refresh design.
