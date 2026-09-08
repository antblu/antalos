---
title: Disaster recovery
description: Recovery order, required backups, and verification steps for rebuilding the Antalos platform.
sidebar:
  order: 1
---

Recover the platform from the bottom up. Git reconstructs desired state, but Git alone does not contain the data or private key material needed for a complete recovery.

Review [Infrastructure architecture](/infrastructure/platform/) for the physical and storage failure domains and [Service availability](/infrastructure/availability/) for the components expected to fail over versus restart or restore.

## Recovery set

Keep recoverable copies of:

| Item | Why it is required |
| --- | --- |
| Git repository | Infrastructure definitions, application manifests, and sealed ciphertext |
| OpenTofu state | Existing infrastructure identity and safe reconciliation |
| Sealed Secrets controller keys | Decrypts every `SealedSecret` committed to Git |
| PostgreSQL backups | Application state and metadata |
| Garage S3 backups or replicas | Nextcloud files and other object data |
| NFS data where required | Shared application files not reconstructed elsewhere |
| Proxmox credentials and configuration | Recreates and accesses the virtual infrastructure |
| DNS provider credential | Restores automated certificate issuance |

Store recovery material outside the cluster and test access to it periodically. Include SQLite/Litestream backups for Headscale, Headplane, and RustDesk, the RustDesk server identity, GitLab repository data and both databases, and any external Talk recording data in the service-specific recovery set.

## Recovery order

1. Restore or verify Proxmox and storage services.
2. Restore the OpenTofu state and local credentials.
3. Apply `infrastructure/opentofu/talostofu` to create Talos nodes and bootstrap Kubernetes.
4. Restore the Sealed Secrets private-key backup before application secrets are reconciled.
5. Apply `infrastructure/opentofu/argotofu` to bootstrap Argo CD and the root app-of-apps.
6. Restore application databases, NFS content, and object data in dependency order, keeping consumers isolated until their data is consistent.
7. Allow Argo CD to reconcile application consumers from Git after their data dependencies are restored. Review auto-sync exposure during bootstrap so applications cannot initialize against an unintended empty database or bucket.
8. Verify ingress, certificates, stateful services, and user-facing applications.

The detailed bootstrap sequence is in [Deployment order](/admin-guide/bootstrap/). The key restoration procedure is in [Kubernetes secrets bootstrap](/admin-guide/secrets/).

## Restore Sealed Secrets first

Restore the private key before Argo CD creates applications that depend on sealed credentials:

```bash
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  apply -f sealed-secrets-priv-key.yaml

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  rollout restart deployment/sealed-secrets-controller -n sealed-secrets
```

The backup must contain every controller key used to encrypt manifests in Git. A newly generated key cannot decrypt existing ciphertext.

## Verify platform recovery

```bash
k() {
  /home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig "$@"
}

k get nodes
k get applications -n argocd
k get sealedsecrets -A
k get certificates -A
k get pods -A
```

Then test each public endpoint over HTTPS and verify application-level data, not only pod readiness.

## Recovery drill

At least periodically:

1. Restore backups into an isolated environment.
2. Validate that Sealed Secrets decrypt successfully.
3. Restore a representative PostgreSQL database and inspect its contents.
4. Retrieve representative objects from Garage S3 and NFS.
5. Record recovery time and any undocumented manual step.
6. Update these runbooks and backup coverage after the drill.

A backup is operationally useful only after a successful restore test.
