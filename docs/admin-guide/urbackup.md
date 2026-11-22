---
title: "UrBackup · Operate"
description: "Deploy UrBackup, enroll clients, and verify backup and restore."
---

<nav class="guide-switcher" aria-label="UrBackup guide sections"><a href="/user-guide/urbackup/">Use</a><a href="/infrastructure/urbackup/">Architecture</a><a aria-current="page" href="/admin-guide/urbackup/">Operate</a></nav>

Use `apps/urbackup/` with the [shared deployment workflow](/admin-guide/deploy-an-application/) to render manifests, prepare credentials, and reconcile the Application.

## 1. Prepare dependencies and inputs

1. Set `URBACKUP_*` variables, including host, image tag, runtime UID/GID, export paths, and requested sizes.

2. Prepare both NFS exports for the configured identity. The `/var/urbackup/backupfolder` setting must be a writable file containing the backup path, not a directory. Account for root-squash and the image’s SETUID/SETGID startup behavior.

3. Plan client connectivity separately: the existing HTTPS ingress exposes the UI, and the ClusterIP ports alone are not a LAN or Internet client endpoint.

## 2. Reconcile the application

Push the reviewed manifests and variables to the branch Argo CD tracks. Let the root app-of-apps discover the Application and run its hooks in order. Keep unresolved templates out of direct Kubernetes applies.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application urbackup

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n urbackup get pods,svc,pvc
```

Confirm the expected Git revision synced and the required workloads are ready. Wait for any initialization or migration Jobs to finish, then test the service.

## 3. Complete identity and first access

The UI ingress references Authentik forward-auth. Create a proxy provider for the exact UrBackup origin and assign it to the embedded outpost. The UrBackup IngressRoute sends `/outpost.goauthentik.io/` requests to the embedded outpost. After reconciliation, request `/outpost.goauthentik.io/ping` on the UrBackup hostname and expect HTTP 204. Then sign in and confirm you return to UrBackup. Configure UrBackup’s own administrator permissions after the proxy login; passing the ingress check does not replace UrBackup’s application authorization.

## 4. Connect and operate the service

1. Choose the required client mode and publish only its documented transport through an appropriate Service/router/firewall path. Keep native client traffic separate from browser forward-auth.

2. Enroll a pilot client, configure retention and backup windows, run the first backup, and restore a sample file.

3. Monitor export free space and protect the server configuration separately from the clients it backs up. Plan a brief outage for server upgrades.

## Availability before maintenance

**Not HA: one backup server, restored with two external NFS exports.**

Updates deliberately permit one unavailable replica, which here means the entire application. The singleton PDB can block drain until an administrator schedules the accepted outage; bypassing it does not create HA.

Define a restart/recovery objective, protect both exports, and prove a client backup and restore after server recovery. Do not scale the server to multiple concurrent writers without an upstream-supported storage/coordination design.

Review [failure behavior](/infrastructure/urbackup/#availability-and-failure-behavior) before maintenance. If the service uses replication or quorum, confirm data has resynchronized and voting capacity has recovered.

## 5. Maintain and recover

Both the configuration export and backup export are essential. Preserve client registration/database state along with stored backup files. An NFS claim’s requested size does not enforce a quota on the export; capacity must be managed on the NFS server.

Read the target version’s release notes and record a recovery point before upgrading. If the release migrates a database schema, plan how to restore the database before rolling back the image. See [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/).

## Troubleshooting

For startup permission errors, inspect which of the two mounts fails and the configured UID/GID. For invisible clients, inspect transport and discovery reachability rather than the HTTPS certificate. For an outpost 404, repair the Authentik callback route/provider mapping.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/urbackup/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/urbackup/certificate.yaml)
- [`storage.yaml`](https://github.com/antblu/antalos/blob/main/apps/urbackup/storage.yaml)
- [`urbackup.yaml`](https://github.com/antblu/antalos/blob/main/apps/urbackup/urbackup.yaml)

[Official UrBackup documentation](https://www.urbackup.org/administration_manual.html).
