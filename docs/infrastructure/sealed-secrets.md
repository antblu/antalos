---
title: "Sealed Secrets \u00b7 Infrastructure Explanation"
description: "Backend components, persistence, placement, and failure boundaries for Sealed Secrets in Antalos."
---

<nav class="guide-switcher" aria-label="Sealed Secrets guide sections"><a href="/user-guide/sealed-secrets/">Overview and User Guide</a><a aria-current="page" href="/infrastructure/sealed-secrets/">Infrastructure Explanation</a><a href="/admin-guide/sealed-secrets/">Deployment and Admin Guide</a></nav>

The controller runs in `sealed-secrets` with the name `sealed-secrets-controller`. Argo CD applies encrypted objects; the controller decrypts them and maintains their target Secrets. Bootstrap restores controller key material before application credentials are reconciled.

## Component boundaries

<figure class="architecture-diagram" aria-label="Sealed Secrets · component flow">
<div class="diagram-heading">Sealed Secrets · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Encrypt</span><ul><li>Private Secret outside Git</li><li>kubeseal + public certificate</li></ul></li><li class="diagram-stage"><span class="diagram-label">Reconcile</span><ul><li>Ciphertext in service directory</li><li>Argo CD → SealedSecret</li></ul></li><li class="diagram-stage"><span class="diagram-label">Decrypt</span><ul><li>Controller + original private key</li><li>Generated Secret → workload</li></ul></li></ol>
<figcaption>Arrows show the main flow between responsibility groups. Parallel boxes are related components, not interchangeable replicas; the text below defines their individual failure and recovery behavior.</figcaption>
</figure>

## State and recovery contract

The external backup must include all controller private keys that encrypted repository secrets. A newly generated valid key cannot decrypt old ciphertext. Restoring Git without those keys is insufficient.

## Availability and failure behavior

Recovery-based controller: the manifest does not explicitly configure multiple replicas. Existing generated Secrets remain usable while the controller is down; new or changed ciphertext waits for reconciliation.

A disruption budget governs voluntary eviction; it does not stop a machine failure, repair external storage, or prove recovery time. The [platform availability reference](/infrastructure/availability/) explains the shared failure domains.

## Configuration ownership

`apps/sealed-secrets/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/sealed-secrets/app.yaml)

## Continue

Read the [deployment guide](/admin-guide/sealed-secrets/) for dependency order, initial credentials, and integration work. The [official documentation](https://github.com/bitnami/sealed-secrets) explains the upstream product; the topology above describes this repository.
