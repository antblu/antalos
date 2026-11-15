---
title: "RustDesk · Operate"
description: "Deploy RustDesk and check client connectivity and relay routing."
---

<nav class="guide-switcher" aria-label="RustDesk guide sections"><a href="/user-guide/rustdesk/">Use</a><a href="/infrastructure/rustdesk/">Architecture</a><a aria-current="page" href="/admin-guide/rustdesk/">Operate</a></nav>

Use `apps/rustdesk/` with the [shared deployment workflow](/admin-guide/deploy-an-application/) to render manifests, prepare credentials, and reconcile the Application.

## 1. Prepare dependencies and inputs

1. Set the `RUSTDESK_*` variables. Prepare the NFS 4.1 export with write access for UID/GID 1003 and working cross-node locks.

2. Seal the server identity in `secret.yaml`. Retain the existing identity when migrating clients from another server.

3. Configure DNS, TCP/UDP firewall rules, and the advertised relay ports using the [RustDesk network runbook](/admin-guide/rustdesk-network/).

## 2. Reconcile the application

Push the reviewed manifests and variables to the branch Argo CD tracks. Let the root app-of-apps discover the Application and run its hooks in order. Keep unresolved templates out of direct Kubernetes applies.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application rustdesk

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n rustdesk get pods,svc,pvc
```

Confirm the expected Git revision synced and the required workloads are ready. Wait for any initialization or migration Jobs to finish, then test the service.

## 3. Complete identity and first access

This is RustDesk Server OSS. Native clients authenticate the server through its identity key and authorize remote access on the target device. No OIDC provider or Server Pro administration API is configured. Do not place an interactive browser authentication challenge in front of native rendezvous or relay listeners.

## 4. Connect and operate the service

1. Configure two clients using the published public key, then test a direct connection and a forced-relay connection from outside the LAN.

2. Confirm that hbbs can reach both advertised relay endpoints and that each maps to one relay process.

3. Schedule a restore drill for hbbs. A `minAvailable: 1` budget on its single replica blocks a normal drain; maintenance requires an accepted outage and a controlled budget adjustment.

## Availability before maintenance

**Not continuously HA end to end: one recoverable rendezvous server, with two independent native relays.**

The single hbbs uses zero surge and one unavailable, so updates interrupt it. Its PDB minimum 1 blocks ordinary eviction of the only replica. Relay StatefulSet updates replace ordinals sequentially; secure WebSocket paths on 443/21119 target the first relay and are not equivalent to the two native relay choices.

Measure rendezvous recovery separately from relay continuity, protect the NFS backup and original key, and exercise direct/native relay/WSS paths separately. Continuous hbbs availability needs a supported design beyond adding a second SQLite writer.

Review [failure behavior](/infrastructure/rustdesk/#availability-and-failure-behavior) before maintenance. If the service uses replication or quorum, confirm data has resynchronized and voting capacity has recovered.

## 5. Maintain and recover

Preserve the Litestream backup and the `rustdesk-identity` sealed private key. The public key is supplied in `apps/rustdesk/public-key.txt`. Replacing the identity changes what clients trust. A one-second copy interval is a backup target, not a guaranteed recovery point.

Read the target version’s release notes and record a recovery point before upgrading. If the release migrates a database schema, plan how to restore the database before rolling back the image. See [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/).

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
