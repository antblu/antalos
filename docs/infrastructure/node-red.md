---
title: Node-RED · Architecture
description: Single-process automation with NFS-backed state and worker rescheduling.
---

<nav class="guide-switcher" aria-label="Node-RED guides"><a href="/user-guide/node-red/">Use</a><a aria-current="page" href="/infrastructure/node-red/">Architecture</a><a href="/admin-guide/node-red/">Operate</a></nav>

Node-RED runs as one Deployment replica. The official container stores flows, credentials, settings, installed nodes, and other user data in `/data`. A static NFS CSI volume mounts `10.30.0.5:/mnt/nvme/node-red` there with UID/GID 1007. The volume is retained if the claim is deleted.

## Availability and failure behavior

This is a **recoverable singleton**, with an outage while Kubernetes detects a failed pod or worker, mounts the same NFS export elsewhere, and starts Node-RED. The Deployment uses `Recreate` for planned updates to avoid overlapping processes on the shared directory. There is no serving replica during an update, and no measured recovery-time guarantee.

NFS is a shared dependency and is not a backup. A NAS outage, inaccessible export, lost data, or wrong ownership prevents startup or loses state. Kubernetes does not fence a partitioned old worker; confirm it has stopped before forcing a replacement that could write the same directory. Node-RED's in-memory context and in-flight messages do not survive a restart. Flows using external brokers, devices, or files have their own recovery contracts.

Node-RED protects its editor and Admin API with native OIDC through `passport-openidconnect`. The strategy exchanges the code with Authentik, fetches UserInfo, checks that its subject matches the ID token subject, and maps that stable subject to a Node-RED user with editor permissions. Authentik application policy controls who can sign in. The strategy package is installed into the persistent `/data/.oidc` directory by an init container; first startup or a package-version change needs npm registry access. A NetworkPolicy limits port 1880 ingress to Traefik pods. Node-RED HTTP In endpoints are separate from editor authentication and need flow-level controls when exposed. The HTTPS certificate comes from `letsencrypt-prod`.

`apps/node-red/` owns the Application, workload, OIDC `settings.js` ConfigMap, sealed client secret, PV/PVC, certificate, and network policy. `apps/variables.yaml` owns the image tag, host, public OIDC endpoints, client ID, package version, and storage inputs. See [administration](/admin-guide/node-red/) and [official Docker guidance](https://nodered.org/docs/getting-started/docker).
