---
title: "RustDesk \u00b7 Deployment and Admin Guide"
description: "Deploy RustDesk with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="RustDesk guide sections"><a href="/user-guide/rustdesk/">Overview and User Guide</a><a href="/infrastructure/rustdesk/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/rustdesk/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/rustdesk/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Set the `RUSTDESK_*` variables. Prepare the NFS 4.1 export with write access for UID/GID 1003 and working cross-node locks.

2. Seal the server identity in `secret.yaml`. Retain the existing identity when migrating clients from another server.

3. Configure DNS, TCP/UDP firewall rules, and the advertised relay ports using the [RustDesk network runbook](/admin-guide/rustdesk-network/).

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application rustdesk

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n rustdesk get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

This is RustDesk Server OSS. Native clients authenticate the server through its identity key and authorize remote access on the target device. No OIDC provider or Server Pro administration API is configured. Do not place an interactive browser authentication challenge in front of native rendezvous or relay listeners.

## 4. Connect and operate the service

1. Configure two clients using the published public key, then test a direct connection and a forced-relay connection from outside the LAN.

2. Confirm that hbbs can reach both advertised relay endpoints and that each maps to one relay process.

3. Schedule a restore drill for hbbs. A `minAvailable: 1` budget on its single replica blocks a normal drain; maintenance requires an accepted outage and a controlled budget adjustment.

## 5. Maintain and recover

Preserve the Litestream backup and the `rustdesk-identity` sealed private key. The public key is supplied in `apps/rustdesk/public-key.txt`. Replacing the identity changes what clients trust. A one-second copy interval is a backup target, not a guaranteed recovery point.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

If IDs resolve but connections fail, inspect the advertised relay endpoint and port routing. If restore loops, inspect NFS access and locks. Fence a partitioned old worker before forced recovery; deleting the lock file does not safely establish single-writer ownership.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/rustdesk/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/rustdesk/certificate.yaml)
- [`config.yaml`](https://github.com/antblu/antalos/blob/main/apps/rustdesk/config.yaml)
- [`hbbr.yaml`](https://github.com/antblu/antalos/blob/main/apps/rustdesk/hbbr.yaml)
- [`hbbs.yaml`](https://github.com/antblu/antalos/blob/main/apps/rustdesk/hbbs.yaml)
- [`ingress.yaml`](https://github.com/antblu/antalos/blob/main/apps/rustdesk/ingress.yaml)
- [`secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/rustdesk/secret.yaml)
- [`services.yaml`](https://github.com/antblu/antalos/blob/main/apps/rustdesk/services.yaml)
- [`storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/rustdesk/storage.yaml)

[Official RustDesk documentation](https://rustdesk.com/docs/en/).
