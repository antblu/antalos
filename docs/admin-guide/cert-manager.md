---
title: "cert-manager \u00b7 Deployment and Admin Guide"
description: "Deploy cert-manager with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="cert-manager guide sections"><a href="/user-guide/cert-manager/">Overview and User Guide</a><a href="/infrastructure/cert-manager/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/cert-manager/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/cert-manager/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Deploy the chart/CRDs before Certificate resources. Set `CERT_MANAGER_CHART_VERSION` and `LETSENCRYPT_EMAIL`.

2. Create a Cloudflare token with the required access to the intended DNS zone. Seal it as `cloudflare-api-token` in namespace `cert-manager` and save the SealedSecret under `apps/cert-manager/`. The issuer references this Secret, but the directory does not currently include its ciphertext.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application cert-manager

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n cert-manager get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

cert-manager has no browser account or OIDC setup. Kubernetes RBAC controls certificate administration, and the sealed DNS token authorizes DNS validation. Restrict that token to the intended zones and use the [sealed credential workflow](/admin-guide/secrets/) rather than pasting it into shell arguments.

## 4. Connect and operate the service

1. Use the staging issuer for a new DNS validation setup, then select `letsencrypt-prod` for trusted application certificates.

2. Confirm the Certificate is Ready and that ingress serves it for the correct hostname. Add expiry visibility to operations.

## 5. Maintain and recover

Keep DNS API access recoverable and preserve the sealing keys for its Secret. Issued TLS Secrets and ACME account keys are runtime state. Reissuance also depends on DNS control and ACME availability.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

Inspect Certificate, CertificateRequest, Order, and Challenge in that order. An IssuerNotFound error is a resource name/kind problem; a DNS challenge failure requires inspecting token permissions and DNS propagation.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/cert-manager/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/cert-manager/certificate.yaml)
- [`issuer.yaml`](https://github.com/antblu/antalos/blob/main/apps/cert-manager/issuer.yaml)

[Official cert-manager documentation](https://cert-manager.io/docs/).

## Repository rendering prerequisite for cert-manager

The current cert-manager Application’s second source uses `directory.include: issuer.yaml`, rather than `yaml-envsubst`. That source neither expands the issuer’s shared-variable placeholders nor discovers a new SealedSecret placed alongside it. Before deploying this part in a fresh fork, change the source to the repository’s `yaml-envsubst` plugin and account for the additional support manifests it will render, or provide an explicitly rendered source containing the issuer and sealed DNS credential. Merely adding a ciphertext file to the directory is insufficient with the current source selection. This guide records the prerequisite; it does not change the application manifest.
