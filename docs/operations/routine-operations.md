---
title: Routine cluster operations
description: Health checks, GitOps change delivery, rollout verification, and node-maintenance procedures for Antalos.
sidebar:
  order: 1
---

Use Git as the normal control plane for application configuration. Use direct `kubectl` changes only for diagnostics, bootstrap, or an explicitly documented recovery operation.

## Daily health check

From the repository root:

```bash
KUBECTL="/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig"

$KUBECTL get nodes -o wide
$KUBECTL get pods -A
$KUBECTL get applications -n argocd
$KUBECTL get certificates -A
```

Investigate nodes that are not `Ready`, pods with repeated restarts, Argo CD applications that are not `Synced` and `Healthy`, and certificates that are not `Ready`.

## Deliver a GitOps change

1. Update manifests and shared values locally.
2. Render or validate the affected resources.
3. Review `git diff` and run `git diff --check`.
4. Commit and push the change.
5. Watch Argo CD reconcile it.

Values shared by manifests belong in `apps/variables.yaml` and are referenced as `${VARIABLE_NAME}`. The `yaml-envsubst` plugin does not process Helm `values.yaml` files, so pass shared variables through the application’s env-substituted `app.yaml` as Helm parameters.

Monitor reconciliation:

```bash
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  get applications -n argocd -w
```

For a specific workload:

```bash
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  rollout status deployment/WORKLOAD -n NAMESPACE --timeout=5m
```

## Inspect a failure

Start with the desired-state controller, then move toward the workload:

```bash
KUBECTL="/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig"

$KUBECTL describe application APP -n argocd
$KUBECTL get events -n NAMESPACE --sort-by=.lastTimestamp
$KUBECTL describe pod POD -n NAMESPACE
$KUBECTL logs POD -n NAMESPACE --all-containers --tail=200
```

Do not correct an Argo-managed resource with a lasting manual edit. Fix its source manifest so reconciliation preserves the change.

## Maintain one node

Confirm that replicated workloads are healthy before draining a node. Pod disruption budgets may intentionally block a drain when eviction would remove the last healthy replica.

```bash
KUBECTL="/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig"
NODE="REPLACE_WITH_NODE_NAME"

$KUBECTL cordon "$NODE"
$KUBECTL drain "$NODE" --ignore-daemonsets --delete-emptydir-data
```

Complete the Talos or hypervisor maintenance, verify the node returns `Ready`, then make it schedulable:

```bash
$KUBECTL get node "$NODE"
$KUBECTL uncordon "$NODE"
```

Afterward, confirm that replicated pods are distributed across different values of `kubernetes.io/hostname`.

## Restart a mutable-tag workload

Most workloads should use immutable version tags from `apps/variables.yaml`. The documentation image intentionally follows the `main` tag while GitHub Actions also publishes an immutable `sha-*` tag. To pull a newly built `main` image without changing the manifest:

```bash
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  rollout restart deployment/docs -n docs
```

For a fully reproducible deployment, replace `DOCS_IMAGE_TAG` with the published `sha-*` tag, commit the variable change, and let Argo CD roll it out.
