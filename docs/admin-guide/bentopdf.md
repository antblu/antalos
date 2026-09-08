---
title: "BentoPDF \u00b7 Deployment and Admin Guide"
description: "Deploy BentoPDF with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="BentoPDF guide sections"><a href="/user-guide/bentopdf/">Overview and User Guide</a><a href="/infrastructure/bentopdf/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/bentopdf/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/bentopdf/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Set `BENTOPDF_HOST` and `BENTOPDF_IMAGE_TAG`; publish the hostname to the shared ingress endpoint.

2. Deploy Traefik, cert-manager, and Authentik. Keep both response headers in `bentopdf-headers` when adjusting middleware.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application bentopdf

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n bentopdf get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

Create an Authentik proxy provider in forward-auth mode for the exact BentoPDF HTTPS origin and assign it to the embedded outpost. Add the host-specific `/outpost.goauthentik.io/` callback route described in the [SSO guide](/admin-guide/single-sign-on/#forward-auth). The middleware reference is already in the ingress, but `apps/traefik/forward-auth.yaml` currently defines an outpost route only for the Traefik dashboard hostname.

## 4. Connect and operate the service

1. Try a small merge and a representative large PDF from an authenticated browser. Confirm downloads work.

2. URL-based conversion may need a separate CORS proxy and a custom frontend build with `VITE_CORS_PROXY_URL`; no such proxy is provisioned here. Follow the upstream self-hosting instructions for the selected image before enabling that feature.

## Availability before maintenance

**HA static serving tier; access depends on the shared identity and ingress services.**

The declared zero-surge update fits two eligible nodes, provided the remaining pod is Ready. A PDB controls eviction; it does not prevent every failed release or node outage.

Measure protected page access after losing one serving pod and separately assess identity/ingress continuity. Preserve an honest distinction between frontend uptime and browser job success.

Use the [component-by-component failure contract](/infrastructure/bentopdf/#availability-and-failure-behavior) before a node drain, database promotion, or upgrade. Restoring a healthy replica count must include data resynchronization and restored voting capacity, not just Running pods.

## 5. Maintain and recover

Git, the image, and ingress configuration reconstruct the server. User input and exported PDFs remain on the client. Downloaded results need the user’s own storage and backup policy.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

If the page works but a tool fails, inspect browser errors for blocked worker resources, cross-origin isolation, or memory exhaustion. If the page never opens, resolve forward-auth and callback routing before troubleshooting PDF processing.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/bentopdf/app.yaml)
- [`bentopdf.yaml`](https://github.com/antblu/antalos/blob/main/apps/bentopdf/bentopdf.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/bentopdf/certificate.yaml)

[Official BentoPDF documentation](https://www.bentopdf.com/docs/).
