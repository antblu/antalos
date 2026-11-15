---
title: "Argo CD · Architecture"
description: "Git reconciliation, repo-server, Redis, and Argo CD controller placement."
---

<nav class="guide-switcher" aria-label="Argo CD guide sections"><a href="/user-guide/argocd/">Use</a><a aria-current="page" href="/infrastructure/argocd/">Architecture</a><a href="/admin-guide/argocd/">Operate</a></nav>

OpenTofu installs the initial chart; `argocd-self` becomes the steady-state owner. The root app-of-apps reads `apps/` using `yaml-envsubst`, which discovers `app.yaml` files. Child sources render support manifests while excluding `app.yaml`, `values.yaml`, and `variables.yaml`. The bootstrap values define replicated server/controller/repo-server roles and Redis HA with Sentinel.

## Components

<figure class="architecture-diagram" aria-label="Argo CD · component flow">
<div class="diagram-heading">Argo CD · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Source</span><ul><li>Git / shared variables</li><li>Root app-of-apps</li></ul></li><li class="diagram-stage"><span class="diagram-label">Reconcile</span><ul><li>yaml-envsubst / Helm rendering</li><li>Replicated Argo controllers + Redis HA</li></ul></li><li class="diagram-stage"><span class="diagram-label">Desired state</span><ul><li>Child Applications</li><li>Kubernetes API → resources</li></ul></li></ol>
</figure>

## Data and recovery

Git reconstructs desired state. Preserve repository credentials, Argo authentication secrets, the sealing key, and bootstrap state. Redis is control-plane support state rather than a backup of application databases.

## Availability and failure behavior

**Partially HA overall: replicated API/rendering and Redis HA design; reconciliation and SSO are not proven by those counts.**

The expected behavior assumes healthy replicas with the intended placement and reachable dependencies. Verify it in a failure drill on your deployment.

### Component redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| API server | 2 replicas; hard anti-affinity | New UI/API requests can use the surviving server. |
| Repo server | 2 replicas; hard anti-affinity | Either can render Git inputs when Git and the plugin are available. |
| Application controller | 2 Deployment replicas; hard anti-affinity; zero-surge, one-unavailable rollout; dynamic round-robin cluster distribution; 5-second heartbeat | Rollouts fit the two eligible general workers without requiring a third pod. A failed controller’s cluster assignment can move to a surviving controller. This upstream feature is alpha and requires a reconciliation drill. |
| Redis HA | 3 chart members; quorum toleration | Sentinel/proxy behavior follows the pinned chart; it is distinct from the bespoke app Redis scripts. |
| Authentication | Native OIDC to Authentik; Dex disabled | Either API server can perform discovery and code exchange without a singleton broker. Authentik, ingress, DNS, and PostgreSQL must remain available. |

### Failover and recovery

API and manifest-rendering requests can retry on the surviving replicas. Redis failover depends on the chart’s HA configuration. Dynamic cluster distribution enables heartbeat-based reassignment of a failed controller’s cluster. This changes the controller from a StatefulSet to a Deployment; the chart migration must be reviewed before reconciliation. Native OIDC removes Dex from the login path. General Argo roles remain on the general workers; only the assigned Redis voters retain quorum-taint access. The Redis proxies use two replicas restricted to the general workers. Authentication still depends on Authentik and PostgreSQL promotion; failed in-progress requests may require a retry.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | Surviving API/rendering replicas and direct OIDC can serve requests; replacement replicas may remain Pending until the failed general worker returns; RTX is not overflow capacity. Authentik primary loss requires database promotion, and an affected controller shard must be reassigned after missed heartbeats. Already-running applications normally do not stop just because Argo cannot reconcile them. |
| RTX worker only | A Redis HA member may use the tainted worker because of its toleration. The whole RTX host also carries the legacy external Kubernetes API endpoint. Configure the optional Talos API VIP to remove that external-client dependency; in-cluster API discovery has a separate path. |
| A second failure before recovery | Check surviving endpoints and capacity before further maintenance. For replicated data or voting groups, check the remaining copies and quorum. |

Losing the RTX Proxmox host takes down both its worker and control-plane VMs. Without the optional Talos VIP, it also takes down the external Kubernetes API address. See [physical hosts and the API endpoint](/infrastructure/availability/#physical-hosts-and-the-api-endpoint).

### Upgrades and voluntary maintenance

Server/repo-server/proxy and application-controller rollouts use zero surge and one unavailable. This lets each two-replica hard anti-affinity group roll across the two general workers without waiting for an impossible third placement; one controller may be unavailable briefly during rollout. Server, repo-server, and application-controller PDBs require one available replica during voluntary eviction. Plugin subPath changes require repo-server replacement. PDBs do not prevent abrupt node failure or override a Deployment rollout strategy.

### Availability limits

Git connectivity, the legacy external API endpoint when VIP is unset, auxiliary singletons outside the login path, and controller reassignment bound complete control-plane availability. A surviving web UI does not prove that manifests are being applied.

### Improving availability

Configure the optional Talos API VIP, reserve eligible failover capacity, and measure both direct OIDC login and reconciliation of the affected cluster during a controlled worker loss. Follow the staged Dex migration in the administrator guide before switching an existing installation.

See [platform availability](/infrastructure/availability/) for shared dependencies and failure-test criteria.

## Configuration ownership

Keep Kubernetes resources in `apps/argocd/` and environment-specific inputs in `apps/variables.yaml`. Use the application’s backup procedure for any settings it stores in its database.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/argocd/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/argocd/certificate.yaml)
- [`secret.yaml`](https://github.com/antblu/antalos/blob/main/apps/argocd/secret.yaml)

## Related guides

- [deployment guide](/admin-guide/argocd/) for setup and recovery
- [official documentation](https://argo-cd.readthedocs.io/en/stable/user-guide/) for product configuration
