---
title: Node-RED · Architecture
description: Single-process automation with NFS-backed state and worker rescheduling.
---

<nav class="guide-switcher" aria-label="Node-RED guides"><a href="/user-guide/node-red/">Use</a><a aria-current="page" href="/infrastructure/node-red/">Architecture</a><a href="/admin-guide/node-red/">Operate</a></nav>

Node-RED runs as one Deployment replica. The official container stores flows, credentials, settings, installed nodes, and other user data in `/data`. A static NFS CSI volume mounts `10.30.0.5:/mnt/nvme/node-red` there with UID/GID 1007. The volume is retained if the claim is deleted.

## Availability and failure behavior

This is a **recoverable singleton**, with an outage while Kubernetes detects a failed pod or worker, mounts the same NFS export elsewhere, and starts Node-RED. The Deployment uses `Recreate` for planned updates to avoid overlapping processes on the shared directory. There is no serving replica during an update, and no measured recovery-time guarantee.

NFS is a shared dependency and is not a backup. A NAS outage, inaccessible export, lost data, or wrong ownership prevents startup or loses state. Kubernetes does not fence a partitioned old worker; confirm it has stopped before forcing a replacement that could write the same directory. Node-RED's in-memory context and in-flight messages do not survive a restart. Flows using external brokers, devices, or files have their own recovery contracts.

The Ingress requires Authentik forward auth, with a separate callback route. A NetworkPolicy limits port 1880 ingress to Traefik pods. Node-RED itself has no configured editor password in this deployment, so those routing controls must be established before exposing the hostname. The HTTPS certificate comes from `letsencrypt-prod`.

`apps/node-red/` owns the Application, workload, PV/PVC, certificate, and network policy. `apps/variables.yaml` owns the image tag, host, and storage inputs. See [administration](/admin-guide/node-red/) and [official Docker guidance](https://nodered.org/docs/getting-started/docker).
