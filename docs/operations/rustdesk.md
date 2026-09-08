---
title: RustDesk remote desktop
description: RustDesk OSS endpoints, NFS recovery, and relay availability.
---

## Deployment

`apps/rustdesk` defines RustDesk Server OSS 1.1.16, one `hbbs` Deployment replica, and two `hbbr` StatefulSet replicas. The root Argo CD application discovers its `app.yaml`; manifests and variables must reach the tracked Git branch before Argo CD can deploy them. This addition has not been applied, rendered, or validated against the cluster.

The setup follows the [official RustDesk server guide](https://rustdesk.com/docs/en/self-host/rustdesk-server-oss/docker/). Native clients use RustDesk's own encrypted protocol and server identity key. No HTTP ingress or ACME certificate is required. WebSocket ports 21118/21119 and the Pro-only console port are not exposed.

## Endpoints and client configuration

The proposed addresses below are in the repository's MetalLB pool. Their availability has not been checked. Hostnames and addresses are configurable in `apps/variables.yaml`; arrange DNS records and any required firewall rules before use.

| Role | DNS name | MetalLB address | Open ports |
| --- | --- | --- | --- |
| ID/rendezvous | `rustdesk.antblu.net` | `10.30.0.242` | TCP 21115, TCP and UDP 21116 |
| First relay | `rustdesk-relay-1.antblu.net` | `10.30.0.243` | TCP 21117 |
| Second relay | `rustdesk-relay-2.antblu.net` | `10.30.0.244` | TCP 21117 |

Set the RustDesk client's **ID Server** to `rustdesk.antblu.net` and **Key** to the contents of `apps/rustdesk/public-key.txt`. Leave **Relay Server** and **API Server** empty. The ID server advertises and checks both relay endpoints. Both relays use the same sealed identity as hbbs and require the key.

Each relay Service selects one StatefulSet ordinal. A shared Service balancing across both pods would let the two participants land on different relay processes; relay pairing state is held in process memory. See the upstream [relay implementation](https://github.com/rustdesk/rustdesk-server/blob/1.1.16/src/relay_server.rs) and [rendezvous implementation](https://github.com/rustdesk/rustdesk-server/blob/1.1.16/src/rendezvous_server.rs).

These addresses are private LAN addresses. For remote access, provide reachable routing or public DNS/NAT for every advertised endpoint. With a single public IP, the two relays need distinct external ports and corresponding changes to their advertised endpoints. The current manifests target separately reachable addresses. The pod network must also resolve and reach the advertised relay endpoints for hbbs health detection.

## Storage and identity

All containers, including initialization containers, run as UID/GID `1003:1003`. The static NFS CSI volume uses `10.30.0.5:/mnt/nvme/Rustdesk`, NFS 4.1, and hard mounts. The export must support NFS 4.1 and permit UID/GID 1003 to create files and directories. Mapping root to 1003 alone does not grant access to a directory that lacks suitable ownership or permissions. No recursive ownership changes or `fsGroup` are configured.

The requested 5 GiB PV size is Kubernetes accounting, not an NFS quota. The volume uses `Retain` to preserve backups when its claim is removed.

RustDesk's live SQLite database is stored in an `emptyDir`. Its bundled database library enables WAL, which [SQLite does not support over a network filesystem](https://www.sqlite.org/wal.html). Litestream continuously copies database changes to `/backup/hbbs-db` on NFS, with a one-second sync interval. A replacement pod restores the last available backup before starting hbbs. The [Litestream configuration](https://litestream.io/reference/config/) and [process supervision guide](https://litestream.io/reference/replicate/) describe this arrangement.

The identity was generated locally and encrypted with the cluster's Sealed Secrets certificate. Only ciphertext and the public key are committed as deployment inputs; plaintext private key material was never written to the workstation filesystem. Each pod copies the mounted Secret into local writable storage and sets the private key mode to 0600. Preserve `secret.yaml` and the Sealed Secrets recovery key to retain the identity. An existing RustDesk installation must retain its existing identity instead of adopting this newly generated one.

## Failure and maintenance behavior

- **hbbs node failure:** the Deployment can create a replacement on another eligible worker after the 60-second not-ready/unreachable toleration. Startup restores NFS backups and retains the same server identity. Recovery also depends on Kubernetes eviction, scheduling capacity, image startup, and NFS lock release; 60 seconds is not an availability guarantee.
- **Single writer:** the hbbs wrapper holds an exclusive NFS lock from before restore until the Litestream supervisor exits. An overlapping replacement exits and retries while the lock is held. Do not use `nolock` or local-only locking, and do not delete the lock file to force recovery. NFS locking is not infrastructure fencing: a partitioned worker should be fenced before forced recovery if it might still be serving traffic.
- **Backup lag:** replication is asynchronous. A failure can lose recent registration changes that have not reached NFS; the one-second interval is a target, not a guaranteed recovery point. Keep NFS backups healthy and preserve the sealed identity independently.
- **Relay node failure:** required pod anti-affinity places the two relay pods on separate nodes. hbbs removes an unreachable relay from selection after its connectivity checks. Connections on the failed process are interrupted and must reconnect. The surviving relay serves new sessions even if Kubernetes cannot immediately replace the failed StatefulSet pod.
- **Updates:** hbbs uses `maxSurge: 0` and `maxUnavailable: 1`, with a brief outage. The relay StatefulSet updates one ordinal at a time without surge. During a node partition, do not force-delete an ordinal until its old worker is fenced.
- **Voluntary maintenance:** both workloads have `minAvailable: 1` disruption budgets. With one hbbs replica, its budget deliberately blocks a normal drain; planned hbbs maintenance needs an accepted outage and a temporary budget adjustment. A PDB does not prevent an involuntary node failure or an update by the workload controller.
- **Dependencies:** both workers must be able to reach the export. The single NFS server is still a storage failure dependency. Its failure prevents hbbs restore and backup progress; two relays do not make that server redundant.

No failover drill, NFS permission test, IP allocation check, manifest validation, or live deployment was performed while adding these files, in accordance with the repository's instructions.
