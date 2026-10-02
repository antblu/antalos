# Repository environment

- Run repository commands from the repository root unless a project guide says otherwise.
- Kubernetes CLI: `/home/linuxbrew/.linuxbrew/bin/kubectl` (Homebrew-installed and not necessarily on `PATH`).
- Cluster kubeconfig: `kubeconfig`.
- For cluster commands, use `/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig ...`.
- `kubeconfig`, `talosconfig`, OpenTofu state, private-key backups, decrypted secrets, and rendered cloud-init are sensitive local or recovery material. Do not expose or add them to public documentation.

## Configuration ownership

- Kubernetes applications and their supporting resources live under `apps/<service>/` and are reconciled by Argo CD.
- Shared, environment-specific Kubernetes application inputs live under the `variables:` key in `apps/variables.yaml`. This includes public hostnames and addresses, node names, Helm chart versions, container image tags, and provisioned volume sizes.
- Talos and VM hardware/topology belong to the matching project under `infrastructure/opentofu/`.
- Debian guest packages and workloads belong to the matching project under `infrastructure/ansible/`.
- Home HAProxy guests are provisioned from `infrastructure/opentofu/haproxy/`; editing cloud-init does not update an existing guest automatically.
- Azure edge configuration uses `infrastructure/azure/variables.yaml` and its separate ignored secret input. Do not put VM or Azure settings in `apps/variables.yaml`.
- Documentation content lives in `docs/`; the Astro/Starlight implementation and navigation live in `site/`; `apps/docs/` deploys the built documentation image.

## Infrastructure access

SSH aliases are configured in `~/.ssh/config`. Always use the aliases rather than copying IP addresses into commands.

### Servers

- `ssh proxmox`
  - Role: Proxmox VE hypervisor and cluster management.
  - Use for VM management, Proxmox diagnostics, and host logs.
- `ssh debian-left`
  - Role: General Debian application VM.
  - The OpenTofu source is `infrastructure/opentofu/lefttofu/` and the Ansible source is `infrastructure/ansible/leftansible/`.
  - The current playbook installs the base Docker host and copies the Caddy Compose project to `/opt/compose/caddy`; it does not start Caddy.
- `ssh debian-rtx`
  - Role: NVIDIA GPU compute server with an RTX 3060 12 GB.
  - Use for llama-swap, Speaches, NVIDIA runtime, and related AI inference diagnostics.
  - Ansible deploys its Compose project under `/opt/compose`.
- `ssh debian-arc`
  - Role: Intel GPU compute and media server with an Arc A310.
  - Use for Nextcloud Talk recording, Immich Machine Learning, Jellyfin, and Docling.
  - Ansible deploys its Compose project under `/opt/compose`.
- `ssh nas`
  - Role: TrueNAS storage server.
  - Use for storage, NFS, datasets, and backups.

### SSH and infrastructure safety

Read-only diagnostics are allowed without asking for permission.

Ask before:

- rebooting or shutting down a server;
- deleting data;
- destroying or recreating VMs;
- modifying storage;
- applying OpenTofu or Ansible changes with disruptive effects; or
- making potentially disruptive network changes.

Make durable VM workload changes in the owning OpenTofu or Ansible project. Changes made only on a guest can be overwritten by the next provisioning run.

## Argo CD rendering and application layout

- `infrastructure/argocd/app-of-apps.yaml` is the root app-of-apps. In `RENDER_MODE=applications`, `yaml-envsubst` recursively discovers `app.yaml` files under `apps/`.
- A service may use Helm sources, repository manifests, a local chart, or a combination of sources, but all resources dedicated to that service must stay within its one `apps/<service>/` tree. Shared operators have their own service directories.
- In normal manifest mode, `yaml-envsubst` recursively renders YAML while excluding files named `app.yaml`, `values.yaml`, and `variables.yaml`.
- The renderer substitutes only placeholders declared in `apps/variables.yaml`. It deliberately preserves runtime shell variables and Argo CD references such as `$values`.
- Put `${VARIABLE_NAME}` references only in sources that actually pass through `yaml-envsubst`. Argo `directory` sources and Helm `values.yaml` files do not receive that substitution pass.
- Pass shared values needed by Helm through parameters or values in an env-substituted `app.yaml`. Do not hardcode application chart versions or container image tags under `apps/`.
- Do not directly apply manifests containing unresolved `${...}` placeholders. Publish through the repository workflow and let Argo CD reconcile the branch declared by the Application.
- Argo CD automated pruning and self-healing can revert live-only fixes. Update the owning source for durable repairs.
- Keep each application's database, cache, storage, migration, certificate, and sealed credential manifests in that application's directory. Nested `chart/` and `manifests/` directories are allowed when the Application sources select them.
- Use `certificate.yaml` for service-owned TLS certificates and the `letsencrypt-prod` ClusterIssuer for trusted public TLS. A nested manifest source may keep that file in its selected manifest subdirectory.

## Secrets

- Commit Kubernetes credentials only as `SealedSecret` resources in the consuming `apps/<service>/` tree. Preserve the exact Secret name, namespace, and key names expected by the workload.
- Use the controller name `sealed-secrets-controller` in namespace `sealed-secrets` when sealing credentials for this repository.
- Preserve existing application encryption keys and integration credentials when restoring data; do not generate replacements unless rotation or a new installation is intended.
- The root `sealed-secrets-priv-key.yaml` is ignored recovery/bootstrap material, not an application manifest and never a file to commit.
- Debian VM credentials belong in the matching ignored/encrypted Ansible inputs. Azure credentials belong in `infrastructure/azure/secrets.yaml`. Neither belongs in `apps/variables.yaml`.

## Availability and rollout design

- Availability is service-specific. The current repository includes HA serving tiers, partially HA systems, and recovery-based singletons. Do not claim one-node-failure tolerance from replica count alone.
- For a new replicated stateless workload, prefer two replicas, required pod anti-affinity on `kubernetes.io/hostname`, and an appropriate PodDisruptionBudget when the product, eligible-node capacity, and dependencies support that design.
- For a Kubernetes Deployment, rollout settings belong under `spec.strategy`. `deploymentStrategy` is only correct when it is the field exposed by a selected Helm chart. A PodDisruptionBudget is a separate Kubernetes resource, not a field in a Deployment pod template.
- The common two-worker Deployment convention is `maxSurge: 0` and `maxUnavailable: 1`; do not copy it to StatefulSets, single-writer databases, operators, or charts without checking their supported update and failover model.
- Stateful applications require an explicit data replication, election/promotion, client-routing, and recovery design. Persistent storage or a second pod alone does not establish HA.
- Record singleton or shared-dependency limits honestly. Follow `docs/infrastructure/availability.md` and the service-specific infrastructure page when changing or documenting an availability contract.

## Deployment workflow

- Consult the application's official documentation and the repository's service-specific administrator guide before changing deployment topology or configuration.
- Respect the sync waves and hooks declared by each Application. Migrations that consume resources created during Sync must not be moved to PreSync.
- An uncommitted local edit is not a deployment input. Do not infer live state from source alone, or source state from a healthy workload.
- When deployment or troubleshooting is requested, keep evidence layers separate: rendered/committed source, Argo CD reconciliation, workload readiness, and the real authenticated or external user transaction.
- A LoadBalancer Service does not create DNS, firewall, NAT, or an application listener. A PersistentVolume does not create its external NFS export or object bucket.

## Style, changes, and validation

- Use block-style YAML for repository-authored Kubernetes and configuration YAML. Do not introduce flow mappings (`{...}`) or flow sequences (`[...]`) into those files. Embedded third-party/generated data, such as dashboard JSON, may retain its native syntax.
- Preserve unrelated working-tree changes. Do not stage or commit changes.
- Do not perform checks, validations, deployments, or live mutations unless the request is troubleshooting a bug or explicitly asks for them. Read-only repository inspection is allowed when needed to review or edit documentation.
- Do not edit application code when the task is limited to repository instructions or documentation.

## Documentation

- Update the handbook when a change affects architecture, configuration ownership, deployment, operations, recovery, or user-visible behavior.
- Keep handbook content in `docs/` and add or update the corresponding navigation in `site/` when a new page must appear on `docs.antblu.net`.
- Documentation describes checked-in design unless it explicitly reports separately collected live evidence. Do not present a source review as current workload health.
