---
title: Find the failing layer
description: Separate desired state, workload health, network access, and real application behavior during an incident.
---

Begin with the user's failed task: signing in, loading a page, syncing a note, sending mail, or running a model. Follow that request through its dependencies. Avoid changing several layers at once.

## Choose the first branch

| Symptom | Start with | Then follow |
| --- | --- | --- |
| Public connection times out | DNS, Azure entrypoint, private transport, home proxies | [Network path](/infrastructure/networking/) |
| Certificate error | Requested hostname and certificate | [cert-manager](/admin-guide/cert-manager/) and ingress |
| Login loop or forbidden response | Authentik access policy, callback, or proxy method | [SSO](/admin-guide/single-sign-on/) |
| Application returns 502 or 503 | Service endpoints, readiness, startup dependencies | The application's **Operate** guide |
| Argo shows OutOfSync | Desired revision, source rendering, resource differences | [Argo CD](/admin-guide/argocd/) |
| Pod stays Pending | Scheduling events, eligible nodes, volume binding | [Storage](/infrastructure/storage/) and [availability](/infrastructure/availability/) |
| Web page works but mail is delayed | Submission, queue, outbound relay, recipient response | [Stalwart](/admin-guide/stalwart/) |
| AI or recording fails while Nextcloud works | Provider, companion endpoint, VM, GPU | [VM lifecycle](/admin-guide/virtual-machines/) |
| Sync is inconsistent between devices | Client errors, authentication, database replication | [Obsidian](/admin-guide/obsidian/) |

## 1. Record the request and the source

Keep the timestamp, hostname, user-visible error, and expected result. Identify the owning directory and tracked Git revision. Do not collect passwords, full callback URLs, or tokens in incident notes.

Argo sync, health, and the latest operation describe different conditions. A healthy application can still have desired-state differences. An accepted synchronization can still leave a workload waiting for storage or initialization.

## 2. Read the relevant workload

Run from the repository root and replace the namespace:

```bash title="Inspect one service before changing it"
SERVICE_NAMESPACE='REPLACE_WITH_NAMESPACE'
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig   -n "$SERVICE_NAMESPACE" get pods,services,endpointslices
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig   -n "$SERVICE_NAMESPACE" get events --sort-by=.metadata.creationTimestamp
```

Discover the current pod before reading its logs. Use the container that handles the failing operation. A database's standby, a Sentinel voter, and a proxy pod have different evidence to offer.

## 3. Check the dependency that blocks progress

A TCP readiness probe shows a listening port. It does not prove successful login, writable storage, correct permissions, or message delivery. Follow the actual database, object endpoint, or external backend referenced by the consumer.

For an Argo operation that does not progress, inspect its phase, resource status, hooks, deletion/finalizer state, and any reconciliation-skip setting before retrying synchronization. For immutable StatefulSet differences, compare the specific fields and preserve data; a healthy persistent workload should not be deleted just to remove a diff.

A periodically re-created Job may be a desired-state/TTL interaction. Inspect whether it is an ordinary managed Job or an Argo hook, and whether its completion policy matches that ownership.

## 4. Make the narrow repair at its owner

Use the [repository map](/infrastructure/repository/). Argo self-healing can overwrite live-only changes. Startup-bound configuration may also require a deliberate rollout after the durable source reaches the cluster. Stateful updates must follow the application's own recovery procedure.

If the failure is outside this repository, record the exact boundary: source, destination, protocol, port, and observed failure. Do not describe a router or firewall change as an application-manifest repair.

## 5. Confirm the user's workflow

| Evidence | Conclusion it supports |
| --- | --- |
| Intended revision reconciled | The source change reached desired state |
| Correct ready replicas and data roles | The workload is running with the intended members |
| Real transaction through the user's route | The application and its dependencies work together |
| Restored replication and voter membership | Redundancy has returned after the repair |

Report any remaining gap. A message in a queue is not proof of delivery; a successful upload is not proof that its backup can be restored. Use [disaster recovery](/admin-guide/disaster-recovery/) when the task requires restoration rather than a configuration repair.
