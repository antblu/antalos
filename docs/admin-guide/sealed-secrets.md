---
title: "Sealed Secrets \u00b7 Deployment and Admin Guide"
description: "Deploy Sealed Secrets with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="Sealed Secrets guide sections"><a href="/user-guide/sealed-secrets/">Overview and User Guide</a><a href="/infrastructure/sealed-secrets/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/sealed-secrets/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/sealed-secrets/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Restore the original key backup before bootstrapping an existing installation. The OpenTofu bootstrap requires `sealed-secrets-priv-key.yaml` at the repository root.

2. For a genuinely new cluster, establish and securely back up its initial controller key, then reseal every application credential for that identity. Do not reuse another installation’s ciphertext without its matching recovery key.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application sealed-secrets

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n sealed-secrets get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

No OIDC integration is needed. Public-certificate access enables encryption, not decryption. Kubernetes RBAC must restrict Secret and controller-key access. Keep private keys in encrypted external storage and never in a documentation example or Git commit.

## 4. Connect and operate the service

1. Confirm the controller can decrypt a representative SealedSecret and that its target Secret has the expected key names.

2. Refresh the external key backup after rotation and rehearse offline recovery-unseal with output discarded or written only to protected storage.

## Availability before maintenance

**Not explicitly HA as a controller; existing generated Secrets remain available independently of its process.**

Controller/key maintenance must keep all required keys available. Updating ciphertext before a required key is loaded can block dependent workloads even when old credentials worked.

Make controller availability explicit if decryption continuity is required, retain all sealing keys, and exercise both existing-consumer continuity and creation of a new encrypted Secret during a controlled controller outage.

Use the [component-by-component failure contract](/infrastructure/sealed-secrets/#availability-and-failure-behavior) before a node drain, database promotion, or upgrade. Restoring a healthy replica count must include data resynchronization and restored voting capacity, not just Running pods.

## 5. Maintain and recover

The external backup must include all controller private keys that encrypted repository secrets. A newly generated valid key cannot decrypt old ciphertext. Restoring Git without those keys is insufficient.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

For decryption failures, compare sealing scope, name, namespace, and controller identity. For a successful SealedSecret with a failing pod, compare the generated Secret’s key names and consumer format. Do not rotate unrelated working keys while repairing one malformed field.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/sealed-secrets/app.yaml)

[Official Sealed Secrets documentation](https://github.com/bitnami/sealed-secrets).
