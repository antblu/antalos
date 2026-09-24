---
title: Node-RED · Operate
description: Deploy the single Node-RED process and recover its NFS-backed data.
---

<nav class="guide-switcher" aria-label="Node-RED guides"><a href="/user-guide/node-red/">Use</a><a href="/infrastructure/node-red/">Architecture</a><a aria-current="page" href="/admin-guide/node-red/">Operate</a></nav>

## Deploy

1. Verify that `10.30.0.5:/mnt/nvme/node-red` is exported to both eligible workers over NFS 4.1 and writable by UID/GID 1007. Back up the entire directory, including credential encryption metadata, flows, settings, and installed nodes. The PV declaration does not create the export.
2. Publish `flows.antblu.net` to the Traefik endpoint. In Authentik, create an OAuth2/OIDC provider and application with issuer `https://auth.antblu.net/application/o/node-red/`. Allow the exact callback `https://flows.antblu.net/auth/strategy/callback`, use an authorization-code confidential client, and bind only intended editors. Set the client ID and public endpoint values in `apps/variables.yaml`; seal the client secret as `node-red-oidc` key `clientSecret`.
3. Publish the manifests and `apps/variables.yaml` to the branch tracked by Argo CD, then let the root Application discover `apps/node-red/app.yaml`. Follow the [shared deployment workflow](/admin-guide/deploy-an-application/). Local uncommitted files are not deployment inputs.
4. Verify the Application is Synced and Healthy, the PVC is Bound, and the single pod is Ready. Open the HTTPS hostname as an allowed and a denied user; confirm Node-RED starts its own OIDC login, the callback works, and a small flow can be deployed. Check direct in-cluster access is denied by the NetworkPolicy. HTTP In endpoints are not covered by `adminAuth`; add their own authorization before exposing sensitive flow endpoints.

The OIDC strategy package is installed into `/data/.oidc` before Node-RED starts. Both containers set `HOME=/data` and `NPM_CONFIG_CACHE=/data/.npm` so UID 1007 can write npm state on the NFS volume. Its first installation or version change requires npm registry access. Node-RED's flow-credential encryption secret is generated in its persistent user directory when needed. Keep the original `/data` contents when restoring encrypted flow credentials. Avoid replacing the directory with an empty export during recovery.

## Recover and maintain

A planned image change stops the old pod before a new pod starts. For worker failure, confirm the original process is stopped or fenced before forcing replacement if the old worker could still access NFS. Then verify the new pod has mounted the same PVC and recovered flows, credentials, installed nodes, and any file-backed context configured by flows. In-memory context and interrupted messages require application-level replay or reprocessing.

Test a controlled failover only after the storage backup and worker fencing plan are ready. Confirm flow behavior after rescheduling, not just pod readiness. The [architecture guide](/infrastructure/node-red/) describes the outage and shared NFS dependency. See [official Docker guidance](https://nodered.org/docs/getting-started/docker) for `/data` persistence and [Node-RED security](https://nodered.org/docs/security) before exposing additional HTTP endpoints.
