---
title: "Antalos documentation \u00b7 Deployment and Admin Guide"
description: "Deploy Antalos documentation with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="Antalos documentation guide sections"><a href="/user-guide/docs/">Overview and User Guide</a><a href="/infrastructure/docs/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/docs/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/docs/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Read the [site authoring guide](/admin-guide/site-authoring/) for content structure and local development.

2. Set `DOCS_HOST`, `DOCS_IMAGE_TAG`, `DOCS_NODE_IMAGE_TAG`, and `DOCS_NGINX_IMAGE_TAG`. Build the image before selecting its immutable SHA tag for deployment.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application docs

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n docs get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

This site is served without native OIDC or forward-auth in its checked-in ingress. Keep operational examples free of credentials. If private documentation is needed, add and document an explicit access-control policy at ingress rather than assuming that the site shares the identity portal’s restrictions.

## 4. Connect and operate the service

1. Publish the image using `.github/workflows/docs-image.yaml`, then let Argo CD reconcile `apps/docs/`. A documentation edit does not change running pods until an image containing that edit is deployed.

2. Prefer a published `sha-<commit>` image tag for reproducible releases. A mutable `main` tag does not itself change a Deployment template or trigger a rollout.

## Availability before maintenance

**HA static serving tier for node loss; current zero-unavailable rollout can be blocked by placement.**

With exactly two eligible nodes already occupied by the two old replicas, the surge pod cannot schedule and zero-unavailable prevents freeing a slot. This is a rollout deadlock condition, not evidence that steady-state node failover is broken.

For predictable updates, provide a third eligible failure domain or change the rollout to a placement-compatible strategy as a separate manifest change. Use immutable images and a real request test during one-node maintenance.

Use the [component-by-component failure contract](/infrastructure/docs/#availability-and-failure-behavior) before a node drain, database promotion, or upgrade. Restoring a healthy replica count must include data resynchronization and restored voting capacity, not just Running pods.

## 5. Maintain and recover

Content, CSS, components, navigation, and build definitions live in Git. The serving pods have no application database. Preserve the source repository and access to published images for recovery.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

If content is old, compare the published image and `DOCS_IMAGE_TAG` with the running revision. If one URL fails, inspect the static route and redirect configuration. `/healthz` checks NGINX liveness, not the correctness of every guide.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/docs/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/docs/certificate.yaml)
- [`deployment.yaml`](https://github.com/antblu/antalos/blob/main/apps/docs/deployment.yaml)

[Official Antalos documentation documentation](https://starlight.astro.build/).
