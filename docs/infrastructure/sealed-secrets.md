---
title: "Sealed Secrets · Architecture"
description: "Reconciliation, controller keys, and recovery of encrypted manifests."
---

<nav class="guide-switcher" aria-label="Sealed Secrets guide sections"><a href="/user-guide/sealed-secrets/">Use</a><a aria-current="page" href="/infrastructure/sealed-secrets/">Architecture</a><a href="/admin-guide/sealed-secrets/">Operate</a></nav>

The controller runs in `sealed-secrets` with the name `sealed-secrets-controller`. Argo CD applies encrypted objects; the controller decrypts them and maintains their target Secrets. Bootstrap restores controller key material before application credentials are reconciled.

## Components

<figure class="architecture-diagram" aria-label="Sealed Secrets · component flow">
<div class="diagram-heading">Sealed Secrets · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Encrypt</span><ul><li>Private Secret outside Git</li><li>kubeseal + public certificate</li></ul></li><li class="diagram-stage"><span class="diagram-label">Reconcile</span><ul><li>Ciphertext in service directory</li><li>Argo CD → SealedSecret</li></ul></li><li class="diagram-stage"><span class="diagram-label">Decrypt</span><ul><li>Controller + original private key</li><li>Generated Secret → workload</li></ul></li></ol>
</figure>

## Data and recovery

The external backup must include all controller private keys that encrypted repository secrets. A newly generated valid key cannot decrypt old ciphertext. Restoring Git without those keys is insufficient.

## Availability and failure behavior

**Not explicitly HA as a controller; existing generated Secrets remain available independently of its process.**

The expected behavior assumes healthy replicas with the intended placement and reachable dependencies. Verify it in a failure drill on your deployment.

### Component redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| Controller | No explicit replica override | New or changed ciphertext needs the controller to reconcile. |
| Generated Secrets | Kubernetes objects consumed by workloads | Already-created credentials do not require a live decrypt call for each request. |
| Sealing private keys | Controller Secret plus external backup | Only the matching original keys can decrypt the committed ciphertext. |

### Failover and recovery

Existing applications can keep using already-generated Secrets while the controller restarts. New workloads that require a missing generated Secret can remain blocked until decryption resumes. Recreating the controller with the original keys restores that function; inventing a new key does not.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | Credential reconciliation can pause if the controller was there, without immediately stopping consumers with usable Secrets. Lost consumers may still restart if their generated Secret remains in Kubernetes. |
| RTX worker only | No dedicated voter. Loss of the API endpoint affects controller reconciliation and Secret retrieval through the API. |
| A second failure before recovery | Check surviving endpoints and capacity before further maintenance. For replicated data or voting groups, check the remaining copies and quorum. |

Losing the RTX Proxmox host takes down both its worker and control-plane VMs, including the default external API endpoint. Factor that dependency into [whole-host failure testing](/infrastructure/availability/#physical-hosts-and-the-api-endpoint).

### Upgrades and voluntary maintenance

Controller/key maintenance must keep all required keys available. Updating ciphertext before a required key is loaded can block dependent workloads even when old credentials worked.

### Availability limits

The private-key backup is disaster recovery, not a hot decryption replica. Kubernetes/etcd and its own recovery set ultimately protect generated Secret objects.

### Improving availability

Make controller availability explicit if decryption continuity is required, retain all sealing keys, and exercise both existing-consumer continuity and creation of a new encrypted Secret during a controlled controller outage.

See [platform availability](/infrastructure/availability/) for shared dependencies and failure-test criteria.

## Configuration ownership

Keep Kubernetes resources in `apps/sealed-secrets/` and environment-specific inputs in `apps/variables.yaml`. Use the application’s backup procedure for any settings it stores in its database.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/sealed-secrets/app.yaml)

## Related guides

- [deployment guide](/admin-guide/sealed-secrets/) for setup and recovery
- [official documentation](https://github.com/bitnami/sealed-secrets) for product configuration
