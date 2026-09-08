---
title: "Traefik \u00b7 Deployment and Admin Guide"
description: "Deploy Traefik with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="Traefik guide sections"><a href="/user-guide/traefik/">Overview and User Guide</a><a href="/infrastructure/traefik/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/traefik/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/traefik/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Deploy MetalLB, reserve `INGRESS_LOAD_BALANCER_IP`, and set `TRAEFIK_HOST` and chart version.

2. Prepare cert-manager and Authentik before relying on the protected dashboard. Keep protocol ports aligned across chart entry points, Services, and upstream firewall rules.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application traefik

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n traefik get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

The dashboard uses Authentik forward-auth. Create a proxy provider for the dashboard origin and assign it to the embedded outpost. The manifest includes a dashboard-host `/outpost.goauthentik.io/` route that bypasses the auth middleware. Other protected apps need equivalent host-specific routes; adding the middleware annotation alone does not create those callbacks.

## 4. Connect and operate the service

1. Test the dashboard with an allowed and a denied user. Confirm the root redirect reaches `/dashboard/`.

2. Exercise representative HTTP, TLS, TCP, and UDP routes from the network where clients run.

3. Keep auth callbacks and non-browser protocol paths free from recursive interactive login challenges.

## 5. Maintain and recover

Routes, middleware, entry points, and certificates are declarative. Preserve authentication-provider configuration and DNS/router state alongside Git. Traefik does not persist application sessions or files.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

An HTTP 404 often means no router matched; a 502/503 points toward backend connectivity or readiness. A 404 specifically on the outpost path needs provider and host-route inspection. Examine the layer that generated the response before changing application replicas.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/traefik/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/traefik/certificate.yaml)
- [`forward-auth.yaml`](https://github.com/antblu/antalos/blob/main/apps/traefik/forward-auth.yaml)
- [`metrics.yaml`](https://github.com/antblu/antalos/blob/main/apps/traefik/metrics.yaml)
- [`rustdesk-udp.yaml`](https://github.com/antblu/antalos/blob/main/apps/traefik/rustdesk-udp.yaml)

[Official Traefik documentation](https://doc.traefik.io/traefik/).
