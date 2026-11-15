---
title: "cert-manager · Operate"
description: "Install cert-manager and configure and verify ACME DNS-01 issuance."
---

<nav class="guide-switcher" aria-label="cert-manager guide sections"><a href="/user-guide/cert-manager/">Use</a><a href="/infrastructure/cert-manager/">Architecture</a><a aria-current="page" href="/admin-guide/cert-manager/">Operate</a></nav>

Use `apps/cert-manager/` with the [shared deployment workflow](/admin-guide/deploy-an-application/) to render manifests, prepare credentials, and reconcile the Application.

## 1. Prepare dependencies and inputs

1. Deploy the chart/CRDs before Certificate resources. Set `CERT_MANAGER_CHART_VERSION`, `CERT_MANAGER_DNS01_RECURSIVE_NAMESERVER`, and `LETSENCRYPT_EMAIL`. The DNS01 resolver uses DNS over HTTPS so its self-check sees public challenge records despite the cluster's split-horizon DNS.

2. Create a Cloudflare token with the required access to the intended DNS zone. Seal it as `cloudflare-api-token` in namespace `cert-manager` and save the SealedSecret under `apps/cert-manager/`. The issuer references this Secret, but the directory does not currently include its ciphertext.

## 2. Reconcile the application

Push the reviewed manifests and variables to the branch Argo CD tracks. Let the root app-of-apps discover the Application and run its hooks in order. Keep unresolved templates out of direct Kubernetes applies.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application cert-manager

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n cert-manager get pods,svc,pvc
```

Confirm the expected Git revision synced and the required workloads are ready. Then test the service.

## 3. Complete identity and first access

cert-manager has no browser account or OIDC setup. Kubernetes RBAC controls certificate administration, and the sealed DNS token authorizes DNS validation. Restrict that token to the intended zones and use the [sealed credential workflow](/admin-guide/secrets/) rather than pasting it into shell arguments.

## 4. Connect and operate the service

1. Use the staging issuer for a new DNS validation setup, then select `letsencrypt-prod` for trusted application certificates.

2. Confirm the Certificate is Ready and that ingress serves it for the correct hostname. Add expiry visibility to operations.

## Availability before maintenance

**Partially HA: replicated admission webhook; certificate issuance is not fully replicated by the manifest.**

Webhook updates use zero surge/one unavailable. Other controller behavior is chart-derived; do not infer identical rollout guarantees from the webhook overrides.

Set and document controller/webhook availability policies where needed, monitor renewal deadlines, and keep DNS access recoverable. Test renewal separately from continued serving of an already-issued certificate.

Review [failure behavior](/infrastructure/cert-manager/#availability-and-failure-behavior) before maintenance.

## 5. Maintain and recover

Keep DNS API access recoverable and preserve the sealing keys for its Secret. Issued TLS Secrets and ACME account keys are runtime state. Reissuance also depends on DNS control and ACME availability.

Read the target version’s release notes and record a recovery point before upgrading. See [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/).

## Troubleshooting

Inspect Certificate, CertificateRequest, Order, and Challenge in that order. An IssuerNotFound error is a resource name/kind problem; a DNS challenge failure requires inspecting token permissions, public DNS propagation, and DNS over HTTPS reachability from the controller pod. The configured resolver is used for all DNS01 self-checks.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/cert-manager/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/cert-manager/certificate.yaml)
- [`issuer.yaml`](https://github.com/antblu/antalos/blob/main/apps/cert-manager/issuer.yaml)

[Official cert-manager documentation](https://cert-manager.io/docs/).

## Repository rendering prerequisite for cert-manager

The current cert-manager Application’s second source uses a `directory` source selecting `issuer.yaml` and `metrics.yaml`, rather than `yaml-envsubst`. That source neither expands the issuer’s shared-variable placeholders nor discovers a new SealedSecret placed alongside it. Before deploying this part in a fresh fork, change the source to the repository’s `yaml-envsubst` plugin and account for the additional support manifests it will render, or provide an explicitly rendered source containing the issuer and sealed DNS credential. Merely adding a ciphertext file to the directory is insufficient with the current source selection. This guide records the prerequisite; it does not change the application manifest.
