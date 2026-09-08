---
title: "Bootstrap the cluster"
description: "Provision Talos, establish the sealing identity, and bring the GitOps platform online in dependency order."
---

Bootstrap works from the infrastructure upward. First decide whether this is a new installation or recovery of an existing one: an existing database or SealedSecret requires its original recovery material.

## 1. Prepare infrastructure and external storage

Complete the [workstation prerequisites](/admin-guide/prerequisites/). Review the Proxmox hosts, network bridges, VM disks, Talos image, and addresses in the OpenTofu stack. Prepare NFS exports and Garage buckets before starting applications that require them.

For recovery, restore the existing OpenTofu state and credentials before applying the stack. Losing state is not permission to recreate occupied infrastructure blindly.

## 2. Provision Talos and Kubernetes

From the repository root:

```bash title="Initialize and provision the Talos stack"
tofu -chdir=infrastructure/opentofu/talostofu init
tofu -chdir=infrastructure/opentofu/talostofu plan
tofu -chdir=infrastructure/opentofu/talostofu apply
```

Review the proposed changes before accepting the apply. The stack creates the VMs, applies Talos configuration, bootstraps the cluster, and writes the repository-root `kubeconfig` with restricted permissions. The RTX control-plane address is the configured API endpoint; the current design does not create a control-plane VIP.

Use the [CLI configuration guide](/admin-guide/cli/) to establish Talos access and inspect node readiness.

## 3. Establish or restore the sealing identity

For an existing installation, restore the encrypted backup as the local, untracked `sealed-secrets-priv-key.yaml` expected by the Argo bootstrap. It must contain every controller key needed by the repository ciphertext.

For a new installation, establish a persistent Sealed Secrets controller identity using the upstream installation/key procedure, back it up, and reseal application credentials for that identity before reconciling them. The checked-in application ciphertext belongs to its original cluster; it is not a reusable set of default credentials.

The Argo bootstrap deliberately refuses to continue without its key-backup file. Follow [Sealed credentials](/admin-guide/secrets/) for scope, key backup, and generated Secret contracts.

## 4. Account for the bootstrap kubeconfig paths

The providers in `argotofu/argocd.tf` use the repository-root kubeconfig, but its local-exec key restoration commands currently refer to `../talostofu/kubeconfig`. Before applying this unchanged stack, provide a private copy at that expected path:

```bash title="Supply the path used by bootstrap local-exec"
install -m 600 kubeconfig infrastructure/opentofu/talostofu/kubeconfig
```

Refresh this copy when regenerating the root kubeconfig. Both are local credentials and must remain untracked. This compatibility step documents the current stack; changing the stack’s paths is a separate infrastructure change.

## 5. Bootstrap Argo CD

```bash title="Initialize and apply the Argo bootstrap"
tofu -chdir=infrastructure/opentofu/argotofu init
tofu -chdir=infrastructure/opentofu/argotofu plan
tofu -chdir=infrastructure/opentofu/argotofu apply
```

The stack installs the initial chart, restores the sealing key before the app-of-apps starts, and waits for the Sealed Secrets controller to load the key. `argocd-self` becomes the steady-state owner of Argo CD. The bootstrap release ignores subsequent chart drift by design.

## 6. Bring dependencies online before consumers

| Layer | Services | Required outcome |
| --- | --- | --- |
| Secret and network foundation | Sealed Secrets, MetalLB, Traefik | Credentials decrypt and service addresses can be advertised |
| Certificates and persistence | cert-manager, OpenEBS, NFS CSI | TLS issuance and storage provisioning/mounts work |
| Database management | CloudNativePG, MariaDB CRDs/operator | Database resources can reconcile |
| Identity | Authentik | Initial administrator and provider setup are available |
| Applications | Individual service directories | Database initialization and migration finish before use |
| Operations | Metrics Server, VictoriaMetrics/Grafana | Current resource metrics and historical observability are available |

The table is a dependency model, not a claim that every Application has global health-gated ordering. Review root auto-sync behavior in a fresh fork before exposing every consumer at once. Per-application sync waves and hooks still control their local startup sequence.

## 7. Finish the work outside Kubernetes

Seal the Cloudflare DNS token referenced by cert-manager. Create identity providers, publish DNS and router rules, assign application roles, register runners or backup clients where needed, and configure mail/model integrations.

A service is ready for users after its [Deployment and Admin Guide](/admin-guide/) is complete and a representative user transaction succeeds. Capture a recovery point once the initial installation is usable.

## Repository rendering prerequisite for cert-manager

The current cert-manager Application’s second source uses `directory.include: issuer.yaml`, rather than `yaml-envsubst`. That source neither expands the issuer’s shared-variable placeholders nor discovers a new SealedSecret placed alongside it. Before deploying this part in a fresh fork, change the source to the repository’s `yaml-envsubst` plugin and account for the additional support manifests it will render, or provide an explicitly rendered source containing the issuer and sealed DNS credential. Merely adding a ciphertext file to the directory is insufficient with the current source selection. This guide records the prerequisite; it does not change the application manifest.
