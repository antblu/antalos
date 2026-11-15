---
title: "Deploy an application from antalos"
description: "The shared workflow for variables, sealed credentials, GitOps reconciliation, and post-deployment configuration."
---

Find the application’s service directory, shared variables, and external dependencies before deploying. Finish by testing the user workflow and establishing how to recover its data.

## 1. Read the service contract

Open its Infrastructure Explanation first. Identify the database operator, storage classes, NFS export, object bucket, node placement, third-voter requirement, and public protocols. Check the administrator guide for setup that happens in the application UI or identity provider.

Keep supporting manifests, database declarations, and sealed credentials inside the service’s single `apps/<service>/` directory. Put its certificate in `certificate.yaml` and use `letsencrypt-prod` where trusted public TLS is required.

## 2. Configure shared variables

Edit `apps/variables.yaml` for hostnames, IPs, node names, chart versions, image tags, and volume sizes. The root plugin renders Application definitions. Child plugin sources render supporting YAML and skip Helm `values.yaml` files.

Pass a shared value needed by a chart through the rendered Application, for example:

```yaml title="Helm parameter inside an env-substituted app.yaml"
helm:
  parameters:
    - name: image.tag
      value: ${EXAMPLE_IMAGE_TAG}
    - name: ingress.hostname
      value: ${EXAMPLE_HOST}
```

Replace the sample `EXAMPLE_*` names with your application’s variables and add them beneath `variables:` in the shared file. Leave placeholder substitution and reconciliation to Argo CD.

## 3. Create credentials and external resources

Follow [Sealed credentials](/admin-guide/secrets/), retaining the exact Secret names, namespaces, and key names consumed by the manifests. Match database owner credentials to the application connection. Preserve encryption keys when restoring existing application data.

Set up the referenced NFS exports, Garage buckets, DNS records, firewall and NAT routes, and registry access. Create the export before binding a PersistentVolume, and configure upstream routing for each public LoadBalancer address.

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

The [documentation site](/infrastructure/docs/#availability-and-failure-behavior) uses this strategy to roll out within its two eligible worker slots.

## 5. Publish and reconcile

After review, publish the change to the branch Argo CD tracks.

The root app-of-apps discovers `app.yaml` resources. Follow each service’s declared sync waves and wait for Secrets, databases, and migration hooks before expecting serving pods to become ready. Do not change a migration to PreSync when it needs resources created during Sync.

## 6. Complete identity and integrations

Use the service-specific guide and [SSO integration reference](/admin-guide/single-sign-on/). Create the provider, callback allowlist, client credentials, and application role mappings. Then finish mail, models, object access, runners, backup agents, or companion backends as applicable.

Test an administrator login, then use an ordinary account to confirm that users can complete their task within the intended access restrictions.

## 7. Record operational readiness

| Evidence | What it demonstrates |
| --- | --- |
| Argo CD source revision and sync | The intended Git change reached desired state |
| Workload readiness and service endpoints | The intended replicas can receive traffic |
| TLS and real user transaction | The network and application work together |
| Data restore drill | Backups and credentials support recovery |
| Controlled failure drill | The documented failover behavior works within observed timing |

Record each result in the application’s operational notes.
