---
title: "Sealed Secrets \u00b7 Overview and User Guide"
description: "What Sealed Secrets does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Sealed Secrets guide sections"><a aria-current="page" href="/user-guide/sealed-secrets/">Overview and User Guide</a><a href="/infrastructure/sealed-secrets/">Infrastructure Explanation</a><a href="/admin-guide/sealed-secrets/">Deployment and Admin Guide</a></nav>

Sealed Secrets allows encrypted Kubernetes credentials to be stored in Git. Administrators encrypt with the controller’s public certificate; the controller uses its private keys to create normal Kubernetes Secrets for workloads. Encryption does not remove the need to protect the live Secret or the private-key backup.

## Access and audience

This is a platform service with no standalone user-facing website. Its consumers use Kubernetes resources or internal endpoints.

## Your first workflow

1. Create the plaintext Secret in a private directory outside Git using the exact destination namespace and name.

2. Encrypt it with the intended cluster’s public certificate and save only the SealedSecret under the consuming service directory.

3. Let Argo CD reconcile it, then inspect the SealedSecret condition and the presence of the generated Secret without printing its values.

4. Preserve every sealing private key needed by committed ciphertext. Use the detailed [credential guide](/admin-guide/secrets/) for creation and recovery.

## When you need an administrator

For decryption failures, compare sealing scope, name, namespace, and controller identity. For a successful SealedSecret with a failing pod, compare the generated Secret’s key names and consumer format. Do not rotate unrelated working keys while repairing one malformed field.

## Availability when using this service

**Not explicitly HA as a controller; existing generated Secrets remain available independently of its process.** Credential reconciliation can pause if the controller was there, without immediately stopping consumers with usable Secrets. Lost consumers may still restart if their generated Secret remains in Kubernetes.

Read [how redundancy and recovery work](/infrastructure/sealed-secrets/#availability-and-failure-behavior), including upgrade interruptions and external dependencies. These are design expectations, not a live status indicator.

## Official documentation

Use the [official Sealed Secrets documentation](https://github.com/bitnami/sealed-secrets) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/sealed-secrets/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/sealed-secrets/).
