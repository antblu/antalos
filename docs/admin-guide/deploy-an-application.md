---
title: "Deploy an application from Antalos"
description: "The shared workflow for variables, sealed credentials, GitOps reconciliation, and post-deployment configuration."
---

An Antalos application is a service directory, its shared variables, and the external dependencies described in its guide. Deployment is complete when the application can perform its intended workflow and its data has a recovery path.

## 1. Read the service contract

Open its Infrastructure Explanation first. Identify the database operator, storage classes, NFS export, object bucket, node placement, third-voter requirement, and public protocols. Check the administrator guide for setup that happens in the application UI or identity provider.

Keep supporting manifests, database declarations, and sealed credentials inside the service’s single `apps/<service>/` directory. Put its certificate in `certificate.yaml` and use `letsencrypt-prod` where trusted public TLS is required.

## 2. Configure shared variables

Edit `apps/variables.yaml` for hostnames, IPs, node names, chart versions, image tags, and volume sizes. The root plugin renders Application definitions; child plugin sources render supporting YAML. It deliberately excludes Helm `values.yaml` files.

Pass a shared value needed by a chart through the rendered Application, for example:

```yaml title="Helm parameter inside an env-substituted app.yaml"
helm:
  parameters:
    - name: image.tag
      value: ${EXAMPLE_IMAGE_TAG}
    - name: ingress.hostname
      value: ${EXAMPLE_HOST}
```

Add the corresponding names beneath `variables:` in the shared file. `EXAMPLE_*` is illustrative, not an existing service. Do not send the literal placeholders to Kubernetes with a direct `kubectl apply -f apps/...`.

## 3. Create credentials and external resources

Follow [Sealed credentials](/admin-guide/secrets/), retaining the exact Secret names, namespaces, and key names consumed by the manifests. Match database owner credentials to the application connection. Preserve encryption keys when restoring existing application data.

Prepare the referenced NFS exports, Garage buckets, DNS records, firewall/NAT routes, and registry access. A PersistentVolume does not create an NFS server, and a LoadBalancer Service does not create a public router rule.

## 4. Choose a rollout that fits placement

Two replicas should be separated by required pod anti-affinity and protected by an appropriate disruption budget. On two eligible workers, a rollout requiring a third anti-affined pod can stall. For ordinary stateless Deployments, the repository convention is:

```yaml title="Deployment strategy and voluntary-disruption budget"
# Inside a Deployment spec:
replicas: 2
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 0
    maxUnavailable: 1
```

Use the equivalent fields supported by the selected Helm chart. Keep the hard `kubernetes.io/hostname` anti-affinity in the pod template and a `minAvailable: 1` PodDisruptionBudget. StatefulSets, single-writer databases, and recovery-based applications need their documented update strategy instead of a copied Deployment block.

The existing docs service currently uses `maxSurge: 1` and `maxUnavailable: 0`; it therefore needs additional eligible placement capacity during a rollout. That is a documented configuration limit, not evidence that the site has a third serving node.

## 5. Publish and reconcile

Use the repository’s approved review and publishing workflow to make the change available on the branch tracked by Argo CD. This guide does not make publication automatic: an uncommitted local change is not visible to the cluster.

The root app-of-apps discovers `app.yaml` resources. Follow each service’s declared sync waves and wait for Secrets, databases, and migration hooks before expecting serving pods to become ready. Do not change a migration to PreSync when it needs resources created during Sync.

## 6. Complete identity and integrations

Use the service-specific guide and [SSO integration reference](/admin-guide/single-sign-on/). Create the provider, callback allowlist, client credentials, and application role mappings. Then finish mail, models, object access, runners, backup agents, or companion backends as applicable.

Test with an ordinary account as well as an administrator. A successful administrator login does not prove the user workflow or access restrictions.

## 7. Record operational readiness

| Evidence | What it demonstrates |
| --- | --- |
| Argo CD source revision and sync | The intended Git change reached desired state |
| Workload readiness and service endpoints | The intended replicas can receive traffic |
| TLS and real user transaction | The network and application work together |
| Data restore drill | Backups and credentials support recovery |
| Controlled failure drill | The documented failover behavior works within observed timing |

Keep these outcomes separate. A green Argo badge is neither a backup nor a node-loss test.
