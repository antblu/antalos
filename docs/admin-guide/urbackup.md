---
title: "UrBackup \u00b7 Deployment and Admin Guide"
description: "Deploy UrBackup with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="UrBackup guide sections"><a href="/user-guide/urbackup/">Overview and User Guide</a><a href="/infrastructure/urbackup/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/urbackup/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/urbackup/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Set `URBACKUP_*` variables, including host, image tag, runtime UID/GID, export paths, and requested sizes.

2. Prepare both NFS exports for the configured identity. The `/var/urbackup/backupfolder` setting must be a writable file containing the backup path, not a directory. Account for root-squash and the image’s SETUID/SETGID startup behavior.

3. Plan client connectivity separately: the existing HTTPS ingress exposes the UI, and the ClusterIP ports alone are not a LAN or Internet client endpoint.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application urbackup

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n urbackup get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

The UI ingress references Authentik forward-auth. Create a proxy provider for the exact UrBackup origin, assign it to the embedded outpost, and add the callback route on that hostname. The existing shared outpost route only covers the Traefik dashboard hostname. Configure UrBackup’s own administrator permissions after the proxy login; passing the ingress check does not replace UrBackup’s application authorization.

## 4. Connect and operate the service

1. Choose the required client mode and publish only its documented transport through an appropriate Service/router/firewall path. Keep native client traffic separate from browser forward-auth.

2. Enroll a pilot client, configure retention and backup windows, run the first backup, and restore a sample file.

3. Monitor export free space and protect the server configuration separately from the clients it backs up. Plan a brief outage for server upgrades.

## 5. Maintain and recover

Both the configuration export and backup export are essential. Preserve client registration/database state along with stored backup files. An NFS claim’s requested size does not enforce a quota on the export; capacity must be managed on the NFS server.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

For startup permission errors, inspect which of the two mounts fails and the configured UID/GID. For invisible clients, inspect transport and discovery reachability rather than the HTTPS certificate. For an outpost 404, repair the Authentik callback route/provider mapping.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/urbackup/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/urbackup/certificate.yaml)
- [`storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/urbackup/storage.yaml)
- [`urbackup.yaml`](https://github.com/antblu/antalos/blob/main/apps/urbackup/urbackup.yaml)

[Official UrBackup documentation](https://www.urbackup.org/administration_manual.html).
