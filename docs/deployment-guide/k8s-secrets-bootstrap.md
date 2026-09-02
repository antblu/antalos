---
title: Kubernetes secrets bootstrap
description: Bootstrap and recover encrypted Kubernetes credentials with Sealed Secrets.
sidebar:
  order: 4
---

This document describes how to bootstrap and manage Kubernetes secrets for this cluster using **Sealed Secrets**.

The repository is designed so that the cluster can be rebuilt from Git without storing plaintext secrets in Git.

## Overview

Secrets are handled using this flow:

```text
                Git
                 │
                 │ encrypted SealedSecret
                 ▼
        ┌───────────────────┐
        │   Argo CD         │
        └─────────┬─────────┘
                  │
                  ▼
        ┌───────────────────┐
        │ Sealed Secrets    │
        │ Controller        │
        └─────────┬─────────┘
                  │ decrypt
                  ▼
        ┌───────────────────┐
        │ Kubernetes Secret │
        └─────────┬─────────┘
                  │
            ┌─────┴─────┐
            ▼           ▼
          CNPG       Authentik
```
## Install kubeseal

`kubeseal` is the client-side utility used to encrypt Kubernetes Secrets into `SealedSecret` resources.

Verify:

```bash
kubeseal --version
```
## Restoring with a Private Key

```bash
kubectl apply -f sealed-secrets-priv-key.yaml
kubectl -n sealed-secrets rollout restart deployment sealed-secrets-controller
```

`infrastructure/opentofu/argotofu` performs this restore automatically on every
`tofu apply`. It restores the key before bootstrapping the app-of-apps and
restarts the controller after its deployment becomes available. The apply stops
with an error when the key backup is missing, rather than letting the controller
silently create an ephemeral key.

The backup must contain every controller key used to seal manifests in Git.
Restoring a different valid key does not decrypt ciphertext produced by a lost
key. After sealing any new manifest, refresh the backup and verify recovery:

```bash
kubeseal --recovery-unseal \
  --recovery-private-key sealed-secrets-priv-key.yaml \
  < apps/authentik/db-secret.yaml \
  > /dev/null
```

## Fetch the Sealed Secrets public certificate

The Sealed Secrets controller has a private key that remains inside the cluster.

The administrator uses the corresponding public certificate to encrypt new secrets.

The public certificate is not secret information.

This cluster uses:

```text
Controller:
sealed-secrets-controller

Namespace:
sealed-secrets
```

Fetch the certificate:

```bash
kubeseal \
  --fetch-cert \
  --controller-name sealed-secrets-controller \
  --controller-namespace sealed-secrets \
  > ~/sealed-secrets-cert.pem
```

The certificate may be stored locally and reused for sealing secrets.
## Create a secure local directory

Plaintext secrets must never be stored in the Git repository.

Create a local directory:

```bash
mkdir -p ~/.kubernetes-secrets
chmod 700 ~/.kubernetes-secrets
```

All plaintext Secret manifests should be created in this directory.

## Key Generation

```bash
# Generate the Authentik secret key
openssl rand -base64 60
# Generate the PostgreSQL application password
openssl rand -base64 32
```
## Create the CNPG plaintext Secret

Create:
```text
~/.kubernetes-secrets/authentik-db-app.yaml
```
with:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: authentik-db-app
  namespace: authentik
type: kubernetes.io/basic-auth
stringData:
  username: authentik
  password: "REPLACE_WITH_GENERATED_POSTGRES_PASSWORD"
```

Do not commit this file.
## Seal the CNPG Secret

Use the public certificate:
```bash
kubeseal \
  --cert ~/sealed-secrets-cert.pem \
  --format yaml \
  < ~/.kubernetes-secrets/authentik-db-app.yaml \
  > ../antalos/apps/authentik/db-secret.yaml
```
The resulting file is safe to commit:
```text
apps/authentik/db-secret.yaml
```
It should contain a `SealedSecret` similar to:
```yaml
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: authentik-db-app
  namespace: authentik
spec:
  encryptedData:
    password: Ag...
    username: Ag...
  template:
    metadata:
      name: authentik-db-app
      namespace: authentik
    type: kubernetes.io/basic-auth
```
The encrypted values can safely be stored in Git.
## Create the Authentik plaintext Secret

The Authentik Helm chart supports using an existing Secret for Authentik configuration instead of having the chart create it.

Create:
```text
~/.kubernetes-secrets/authentik-secrets.yaml
```
with:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: authentik-secrets
  namespace: authentik
type: Opaque
stringData:
  AUTHENTIK_SECRET_KEY: "REPLACE_WITH_GENERATED_AUTHENTIK_SECRET_KEY"
  AUTHENTIK_POSTGRESQL__PASSWORD: "REPLACE_WITH_GENERATED_POSTGRES_PASSWORD"
```

The `AUTHENTIK_POSTGRESQL__PASSWORD` value must exactly match the password used in the CNPG Secret.
## Seal the Authentik Secret
Run:
```bash
kubeseal \
  --cert ~/sealed-secrets-cert.pem \
  --format yaml \
  < ~/.kubernetes-secrets/authentik-secrets.yaml \
  > apps/authentik/secrets.yaml
```
## Exporting Backup Secrets

```bash
kubectl -n sealed-secrets get secret \
  -l sealedsecrets.bitnami.com/sealed-secrets-key \
  -o yaml > sealed-secrets-priv-key.yaml
```

**Never commit this file to Git.**
Store it in a secure encrypted backup location.
>The Sealed Secrets project explicitly recommends **backing up these keys** and warns that **losing them prevents existing SealedSecrets from being decrypted**.
## Useful commands

### Fetch controller certificate

```bash
kubeseal \
  --fetch-cert \
  --controller-name sealed-secrets-controller \
  --controller-namespace sealed-secrets \
  > ~/sealed-secrets-cert.pem
```
### Check SealedSecrets
```bash
kubectl -n authentik get sealedsecrets
```
### Check generated Secrets
```bash
kubectl -n authentik get secrets
```
### Check a SealedSecret
```bash
kubectl -n authentik describe sealedsecret authentik-secrets
```
