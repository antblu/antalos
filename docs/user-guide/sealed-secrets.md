---
title: "Sealed Secrets · Use"
description: "Encrypt a Kubernetes Secret for its destination name and namespace."
---

<nav class="guide-switcher" aria-label="Sealed Secrets guide sections"><a aria-current="page" href="/user-guide/sealed-secrets/">Use</a><a href="/infrastructure/sealed-secrets/">Architecture</a><a href="/admin-guide/sealed-secrets/">Operate</a></nav>

Sealed Secrets allows encrypted Kubernetes credentials to be stored in Git. Administrators encrypt with the controller’s public certificate; the controller uses its private keys to create normal Kubernetes Secrets for workloads. Encryption does not remove the need to protect the live Secret or the private-key backup.

## Access

Use Kubernetes resources or internal endpoints to work with this service.

## Seal a Kubernetes Secret

1. Create the plaintext Secret in a private directory outside Git using the exact destination namespace and name.

2. Encrypt it with the intended cluster’s public certificate and save only the SealedSecret under the consuming service directory.

3. Let Argo CD reconcile it, then inspect the SealedSecret condition and the presence of the generated Secret without printing its values.

4. Preserve every sealing private key needed by committed ciphertext. Use the detailed [credential guide](/admin-guide/secrets/) for creation and recovery.

## Get help

Ask the service administrator about missing or changed credentials. Do not paste credential values into tickets or attempt to reuse another installation’s encrypted files.

## During an interruption

Existing Kubernetes Secrets can remain available during a controller outage. Ask the administrator to check reconciliation if a new or changed Secret is missing.

See [expected failure behavior and recovery](/infrastructure/sealed-secrets/#availability-and-failure-behavior).

## Official documentation

Use the [official Sealed Secrets documentation](https://github.com/bitnami/sealed-secrets) for your installed version. Ask your administrator which optional features are enabled.

See the [architecture](/infrastructure/sealed-secrets/) or [deployment guide](/admin-guide/sealed-secrets/).
