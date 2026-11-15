---
title: "antalos documentation · Architecture"
description: "Starlight builds, GHCR images, NGINX replicas, and HTTPS delivery."
---

<nav class="guide-switcher" aria-label="antalos documentation guide sections"><a href="/user-guide/docs/">Use</a><a href="/infrastructure/docs/">Architecture</a><a aria-current="page" href="/admin-guide/docs/">Operate</a></nav>

Astro Starlight reads Markdown from `docs/` through `site/src/content.config.ts`. The static build is copied into an unprivileged NGINX image and published by GitHub Actions. Two stateless NGINX replicas serve the image on port 8080 behind a Kubernetes Service and Traefik. cert-manager manages `docs-tls`.

## Components

<figure class="architecture-diagram" aria-label="antalos documentation · component flow">
<div class="diagram-heading">antalos documentation · component flow</div>
<ol class="diagram-flow" role="list"><li class="diagram-stage"><span class="diagram-label">Build</span><ul><li>docs/ + site/</li><li>Astro -> image in GHCR</li></ul></li><li class="diagram-stage"><span class="diagram-label">Delivery</span><ul><li>Argo CD -> Deployment</li><li>2 NGINX replicas</li></ul></li><li class="diagram-stage"><span class="diagram-label">Read</span><ul><li>Service <- Traefik HTTPS</li><li>Reader / static search index</li></ul></li></ol>
</figure>

## Data and recovery

Content, CSS, components, navigation, and build definitions live in Git. The serving pods have no application database. Preserve the source repository and access to published images for recovery.

## Availability and failure behavior

**replicated static serving tier with placement-compatible rolling updates.**

The expected behavior assumes healthy replicas with the intended placement and reachable dependencies. Verify it in a failure drill on your deployment.

### Component redundancy

| Component | Declared layout | Mechanism |
| --- | --- | --- |
| NGINX | 2 stateless replicas; required host anti-affinity | The Service routes to ready copies of the same image. |
| Persistent state | None in serving pods | Pages and search assets are reconstructed from Git and the built image. |
| Eviction | PDB minimum 1 | A voluntary eviction should retain a healthy serving pod. |
| Rollout | maxSurge 0; maxUnavailable 1 | Replaces one replica at a time within the two existing eligible worker slots. |

### Failover and recovery

The surviving NGINX pod serves new requests after endpoint detection/routing converges. No database promotion or volume restoration is required. The failed node does not contain the only copy of the site source or published image.

### Failure scenarios

| Failure | Expected behavior and remaining dependency |
| --- | --- |
| One main worker | One pod can continue serving. However, hard anti-affinity prevents the lost replica from simply joining the survivor on the same node; availability returns to full redundancy only when another eligible placement is available. |
| RTX worker only | The app has no dedicated RTX dependency, but its ordinary pods do not automatically tolerate the quorum taint. Spare capacity on a tainted node is not automatically usable surge capacity. |
| A second failure before recovery | Check surviving endpoints and capacity before further maintenance. For replicated data or voting groups, check the remaining copies and quorum. |

Losing the RTX Proxmox host takes down both its worker and control-plane VMs, including the default external API endpoint. Factor that dependency into [whole-host failure testing](/infrastructure/availability/#physical-hosts-and-the-api-endpoint).

### Upgrades and voluntary maintenance

The rollout frees one occupied worker slot before scheduling its replacement, avoiding the former third-slot surge requirement. A failed replacement leaves one old ready replica serving while operators inspect image pulls or readiness.

### Availability limits

Ingress, DNS, network, and API-driven endpoint updates remain shared dependencies. The shared website image-refresh CronJob polls GHCR every minute and triggers a rollout when the selected mutable tag changes digest. It uses a pod-template annotation rather than taking ownership of the image field. Registry or refresh-Job failure delays delivery while existing pods continue serving. The recorded digest is rollout intent; actual pod image IDs establish which image is running.

### Improving availability

Retain commit-tagged images for rollback and exercise real requests during one-node maintenance. Monitor refresh Jobs, rollout readiness, and public delivery separately.

See [platform availability](/infrastructure/availability/) for shared dependencies and failure-test criteria.

## Configuration ownership

Keep Kubernetes resources in `apps/docs/` and environment-specific inputs in `apps/variables.yaml`. Use the application’s backup procedure for any settings it stores in its database.

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/docs/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/docs/certificate.yaml)
- [`deployment.yaml`](https://github.com/antblu/antalos/blob/main/apps/docs/deployment.yaml)

## Related guides

- [deployment guide](/admin-guide/docs/) for setup and recovery
- [official documentation](https://starlight.astro.build/) for product configuration
