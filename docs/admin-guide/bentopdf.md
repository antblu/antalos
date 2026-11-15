---
title: "BentoPDF · Operate"
description: "Deploy BentoPDF, configure forward-auth, and test PDF downloads."
---

<nav class="guide-switcher" aria-label="BentoPDF guide sections"><a href="/user-guide/bentopdf/">Use</a><a href="/infrastructure/bentopdf/">Architecture</a><a aria-current="page" href="/admin-guide/bentopdf/">Operate</a></nav>

Use `apps/bentopdf/` with the [shared deployment workflow](/admin-guide/deploy-an-application/) to render manifests, prepare credentials, and reconcile the Application.

## 1. Prepare dependencies and inputs

1. Set `BENTOPDF_HOST` and `BENTOPDF_IMAGE_TAG`; publish the hostname to the shared ingress endpoint.

2. Deploy Traefik, cert-manager, and Authentik. Keep both response headers in `bentopdf-headers` when adjusting middleware.

## 2. Reconcile the application

Push the reviewed manifests and variables to the branch Argo CD tracks. Let the root app-of-apps discover the Application and run its hooks in order. Keep unresolved templates out of direct Kubernetes applies.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application bentopdf

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n bentopdf get pods,svc,pvc
```

Confirm the expected Git revision synced and the required workloads are ready. Then test the service.

## 3. Complete identity and first access

Create an Authentik proxy provider in forward-auth mode for the exact BentoPDF HTTPS origin and assign it to the embedded outpost. Add the host-specific `/outpost.goauthentik.io/` callback route described in the [SSO guide](/admin-guide/single-sign-on/#forward-auth). The middleware reference is already in the ingress, but `apps/traefik/forward-auth.yaml` currently defines an outpost route only for the Traefik dashboard hostname.

## 4. Connect and operate the service

1. Try a small merge and a representative large PDF from an authenticated browser. Confirm downloads work.

2. URL-based conversion may need a separate CORS proxy and a custom frontend build with `VITE_CORS_PROXY_URL`; no such proxy is provisioned here. Follow the upstream self-hosting instructions for the selected image before enabling that feature.

## Availability before maintenance

**HA static serving tier; access depends on the shared identity and ingress services.**

The declared zero-surge update fits two eligible nodes, provided the remaining pod is Ready. A PDB controls eviction; it does not prevent every failed release or node outage.

After losing one pod, load the protected page and run a PDF job. Check the Authentik and ingress paths if the page fails to load. Check the browser if the PDF job fails.

Review [failure behavior](/infrastructure/bentopdf/#availability-and-failure-behavior) before maintenance.

## 5. Maintain and recover

Git, the image, and ingress configuration reconstruct the server. User input and exported PDFs remain on the client. Downloaded results need the user’s own storage and backup policy.

Read the target version’s release notes and record a recovery point before upgrading. See [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/).

## Troubleshooting

If the page works but a tool fails, inspect browser errors for blocked worker resources, cross-origin isolation, or memory exhaustion. If the page never opens, resolve forward-auth and callback routing before troubleshooting PDF processing.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/bentopdf/app.yaml)
- [`bentopdf.yaml`](https://github.com/antblu/antalos/blob/main/apps/bentopdf/bentopdf.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/bentopdf/certificate.yaml)

[Official BentoPDF documentation](https://www.bentopdf.com/docs/).
