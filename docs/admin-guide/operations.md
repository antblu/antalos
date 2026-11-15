---
title: "Operate and maintain the platform"
description: "Separate live health from GitOps state and plan maintenance around actual failure domains."
---

Check the tracked Git revision, the running Kubernetes resources, and the user’s transaction. Use the result of each check to narrow the investigation.

## Read the platform state

From the repository root:

```bash title="Platform overview"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig get nodes -o wide
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n argocd get applications
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig get certificates -A
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig get pods -A
```

Use current owner-managed pods to judge availability. Retained failed Jobs and historical rollout pods may explain an incident without describing the current serving state. A missing metric is not a measured zero.

Before planned node maintenance, run `python3 tools/check-node-failover.py`. Resolve its blockers and follow the [node-failure rollout and remaining dependencies](/infrastructure/availability/#roll-out-the-node-failure-improvements). A passing gate alone does not authorize a shutdown or establish end-to-end HA.

## Investigate one service

Replace the namespace and pod placeholders with names from the platform overview.

```bash title="Narrow the investigation"
APP_NAMESPACE='REPLACE_WITH_NAMESPACE'
APP_POD='REPLACE_WITH_CURRENT_POD'

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n "$APP_NAMESPACE" get events --sort-by=.lastTimestamp

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n "$APP_NAMESPACE" describe pod "$APP_POD"

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n "$APP_NAMESPACE" logs "$APP_POD" --all-containers --tail=100
```

Follow the symptom:

| Observation | Next boundary |
| --- | --- |
| Pending pod | Resource requests, taints, required anti-affinity, PVC placement, rollout surge |
| CreateContainerConfigError | Secret existence and exact key references |
| CrashLoopBackOff | Previous container termination and logs, startup configuration, data permissions |
| Ready pods with failing requests | Service selectors/endpoints, ingress, database/Redis/object dependencies |
| Healthy service but Argo Progressing | Reconciliation pause, current hook, ownerReferences, stale operation state |
| HPA metrics unavailable | Metrics Server API, kubelet access, resource requests |

Do not print complete Secret objects to diagnose a key-name mismatch. Inspect names and consumer references first.

## Deliver a durable repair

Fix the owning service directory or shared variables, publish the reviewed change, and watch Argo CD reconcile the revision. Record any direct incident repair in Git so self-healing preserves it.

When reporting a repair, record Argo sync/health/operation, current workload readiness, a representative user transaction, and whether the change is persisted in the tracked branch. Report remaining blockers individually.

## Maintain one node at a time

Read [service availability](/infrastructure/availability/) before cordoning. Identify single-replica services, local volumes, RTX voters, and workloads with strict placement. Confirm that the surviving data members are healthy and that backups are available.

```bash title="Cordon a selected node"
MAINTENANCE_NODE='REPLACE_WITH_NODE_NAME'
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  cordon "$MAINTENANCE_NODE"
```

Drain only after reviewing which workloads will move and which will stop. A basic drain does not silently discard emptyDir data:

```bash title="Drain after reviewing workload and storage impact"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  drain "$MAINTENANCE_NODE" --ignore-daemonsets
```

If it blocks on a disruption budget or emptyDir, resolve that service’s maintenance requirements. RustDesk and UrBackup each have a budget retaining their only server replica. Do not routinely add `--force`, `--disable-eviction`, or `--delete-emptydir-data` to bypass an unexplained block. For a service whose local data is deliberately disposable, approve its documented restart/restore path before allowing that specific disruption.

After Talos/hypervisor maintenance, wait for the node and data replicas to recover, then uncordon:

```bash title="Return the node to service"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  get node "$MAINTENANCE_NODE"

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  uncordon "$MAINTENANCE_NODE"
```

Wait for replication and quorum to recover before taking the next failure domain offline. Check the local volume and its data when a replacement pod appears on another node.

## Roll out a new documentation image

Prefer a published immutable `sha-<commit>` value in `DOCS_IMAGE_TAG`. If intentionally using `main`, first confirm that the image build completed, then restart the Deployment to pull that tag:

```bash title="Refresh the mutable documentation image"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n docs rollout restart deployment/docs
```

The docs Deployment replaces one replica at a time. If it stalls, check replacement pod placement, image pulls, and readiness. [Documentation architecture](/infrastructure/docs/).
