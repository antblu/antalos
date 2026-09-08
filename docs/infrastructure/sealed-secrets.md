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

**Availability classification: Not explicitly HA as a controller; existing generated Secrets remain available independently of its process.**

This is an interpretation of the checked-in configuration, assuming the declared replicas are healthy, separated as intended, and their required dependencies are reachable. It is not a live-health result or a completed failure drill.

### What supplies redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Controller | No explicit replica override | New or changed ciphertext needs the controller to reconcile. |
| Generated Secrets | Kubernetes objects consumed by workloads | Already-created credentials do not require a live decrypt call for each request. |
| Sealing private keys | Controller Secret plus external backup | Only the matching original keys can decrypt the committed ciphertext. |

### How a failure is handled

Existing applications can keep using already-generated Secrets while the controller restarts. New workloads that require a missing generated Secret can remain blocked until decryption resumes. Recreating the controller with the original keys restores that function; inventing a new key does not.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | Credential reconciliation can pause if the controller was there, without immediately stopping consumers with usable Secrets. Lost consumers may still restart if their generated Secret remains in Kubernetes. |
| RTX worker only | No dedicated voter. Loss of the API endpoint affects controller reconciliation and Secret retrieval through the API. |
| A second failure before recovery | Outside the stated single-failure envelope; assess remaining data copies, quorum, endpoints, and capacity before further maintenance. |

An RTX **worker VM** failure is not the same as an RTX **Proxmox host** failure. The latter also removes its control-plane VM and the configured API address. Read the [physical failure-domain explanation](/infrastructure/availability/#physical-hosts-and-the-api-endpoint) before making a whole-host HA claim.

### Upgrades and voluntary maintenance

Controller/key maintenance must keep all required keys available. Updating ciphertext before a required key is loaded can block dependent workloads even when old credentials worked.

### What prevents a stronger HA claim

The private-key backup is disaster recovery, not a hot decryption replica. Kubernetes/etcd and its own recovery set ultimately protect generated Secret objects.

### What would improve the availability contract

Make controller availability explicit if decryption continuity is required, retain all sealing keys, and exercise both existing-consumer continuity and creation of a new encrypted Secret during a controlled controller outage.

These are operational/design requirements, not changes made to the deployment by this documentation. The [shared availability reference](/infrastructure/availability/) explains election, replication, durability, recovery time, and shared dependencies; the manifest links below identify this service’s source.

## Configuration ownership

`apps/sealed-secrets/` owns this service’s Kubernetes resources. Hostnames, addresses, versions, node names, and volume sizes belong in `apps/variables.yaml`. Runtime settings stored in a product database need that product’s backup and administration procedure.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/sealed-secrets/app.yaml)

## Continue

Read the [deployment guide](/admin-guide/sealed-secrets/) for dependency order, initial credentials, and integration work. The [official documentation](https://github.com/bitnami/sealed-secrets) explains the upstream product; the topology above describes this repository.
