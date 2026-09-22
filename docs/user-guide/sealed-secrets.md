---
title: "Sealed Secrets · Use"
description: "What Sealed Secrets does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Sealed Secrets guide sections"><a aria-current="page" href="/user-guide/sealed-secrets/">Use</a><a href="/infrastructure/sealed-secrets/">Architecture</a><a href="/admin-guide/sealed-secrets/">Operate</a></nav>

Sealed Secrets allows encrypted Kubernetes credentials to be stored in Git. Administrators encrypt with the controller’s public certificate; the controller uses its private keys to create normal Kubernetes Secrets for workloads. Encryption does not remove the need to protect the live Secret or the private-key backup.

## Access and audience

This is a platform service with no standalone user-facing website. Its consumers use Kubernetes resources or internal endpoints.

## Your first workflow

1. Create the plaintext Secret in a private directory outside Git using the exact destination namespace and name.

2. Encrypt it with the intended cluster’s public certificate and save only the SealedSecret under the consuming service directory.

3. Let Argo CD reconcile it, then inspect the SealedSecret condition and the presence of the generated Secret without printing its values.

4. Preserve every sealing private key needed by committed ciphertext. Use the detailed [credential guide](/admin-guide/secrets/) for creation and recovery.

## Get help

Ask the service administrator about missing or changed credentials. Do not paste credential values into tickets or attempt to reuse another installation’s encrypted files.

## During an interruption

An interruption can affect the applications that depend on this platform service. Ask the administrator to identify the affected service and expected recovery path.

Administrators can read [the architecture and recovery limits](/infrastructure/sealed-secrets/#availability-and-failure-behavior).

## Official documentation

Use the [official Sealed Secrets documentation](https://github.com/bitnami/sealed-secrets) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/sealed-secrets/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/sealed-secrets/).
