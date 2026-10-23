---
title: "Renovate · Operate"
description: "Operate the stateless Renovate CronJob using the antblu-renovate GitHub App."
---

<nav class="guide-switcher" aria-label="Renovate guide sections"><a href="/user-guide/renovate/">Use</a><a href="/infrastructure/renovate/">Architecture</a><a aria-current="page" href="/admin-guide/renovate/">Operate</a></nav>

## Configuration and credentials

The service lives in `apps/renovate/`. Shared inputs in `apps/variables.yaml` select the image, hourly schedule (`17 * * * *`, UTC), GitHub App ID `5033067`, and installation ID `163769372`. The App is `antblu-renovate`. Autodiscovery includes repositories accessible to that installation; change repository access in the GitHub App installation settings.

The `renovate-github-app` SealedSecret supplies `private-key.pem`. The mounted config signs a short-lived JWT and exchanges it for an installation token at the start of each pod. Neither token nor private key belongs in shared variables. Preserve the Sealed Secrets recovery key using the existing cluster recovery procedure.

For credential rotation, seal the replacement PEM from a readable local path; never put the plaintext file in the repository:

```bash
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n renovate create secret generic renovate-github-app \
  --from-file=private-key.pem=/secure/path/app-private-key.pem \
  --dry-run=client -o json |
  /home/linuxbrew/.linuxbrew/bin/kubeseal --kubeconfig kubeconfig \
    --controller-name sealed-secrets-controller \
    --controller-namespace sealed-secrets --format yaml \
    > apps/renovate/sealed-secret.yaml
```

Retain sync wave `0` on the SealedSecret. Publish the reviewed change before revoking the previous GitHub key, and verify a new run authenticates successfully.

### Dependency coverage and version ownership

Kubernetes deployment and application-build versions belong in `apps/variables.yaml`. Debian workload versions belong in the matching Ansible project's `variables.yaml`; `site.yml` loads those files alongside operational inputs in `vars/main.yml`. Homelable has its own `homelable/variables.yaml`. Keep credentials in the existing protected vaults.

The custom managers read these version files. Put an annotation immediately above each upstream version, with optional metadata in the order shown:

```yaml
variables:
  # renovate: datasource=helm depName=authentik registryUrl=https://charts.goauthentik.io
  AUTHENTIK_CHART_VERSION: 2026.8.3
```

For separate image tags, use `# renovate: datasource=docker depName=IMAGE_REPOSITORY`. For complete `repository:tag@sha256:...` values, use `# renovate-image: depName=IMAGE_REPOSITORY`. The latter manager extracts the tag and digest separately. `registryUrl`, `versioning`, `extractVersion`, and `depType` are optional scalar-annotation fields. Quoted values are supported. Use the actual image repository consumed by the workload, including registry names.

All external application Helm chart versions and image tags are covered, including build bases and the Argo CD yq/CMP helper images. Both Argo CD self-management parameters and the OpenTofu bootstrap read the helper versions from `apps/variables.yaml`; the unrendered Helm values file has empty image placeholders. Invoice Ninja's local chart also receives image pins through Application parameters rather than versioned defaults. Its chart's own `Chart.yaml` version is local metadata, not an external chart dependency.

The Kubernetes and Argo CD managers explicitly scan repository YAML. Native managers continue tracking package manifests/lockfiles, GitHub Actions, and OpenTofu providers. Those tools require literal dependency metadata in their own formats; they cannot all consume YAML variables. Protocol selections, persisted runtime metadata, schema versions, and operator-controlled configuration revisions are not upstream release pins. VM operating-system image URLs/checksums and Terraform version contracts remain in their existing OpenTofu projects; this workload-image coverage check does not claim automated OS image upgrades.

Docker versioning retains image flavor suffixes. Explicit numeric-build rules handle Medusa, Mautic, Zammad, Intel PyTorch, and Jellyfin revision tags, so a new build of the same release is not silently treated as an incompatible flavor. Open WebUI remains restricted to unprefixed numeric tags. Full image references and scalar annotations marked `depType=floating` enable digest pinning and subsequent digest updates for tags such as `main`, `latest`, and `OIDC`. Digest pinning can only work when Renovate can read the upstream registry. It tracks a selected channel; it does not infer which different channel an operator intends.

Nextcloud add-on releases use the Nextcloud app-store datasource. Their archive SHA-512 pins require coordinated review: Renovate opens draft PRs labelled `coordinated-upgrade`, and the coverage check rejects a changed add-on version with its previous checksum. Review compatibility with the deployed Nextcloud release, download the referenced release archive, and update its checksum before marking the PR ready. Odoo OCA commits track the `19.0` branches through Git reference digests and also require coordinated review. Medusa's shared release version is tracked in addition to its native npm dependencies; keep those versions aligned. SuiteCRM's separate image tag/digest are extracted together; preserve its [coordinated upgrade procedure](/admin-guide/suitecrm/) and release-archive checksum.

The `Renovate dependency coverage` workflow validates `renovate.json` and runs `tools/check-renovate-coverage.mjs` inside the selected Renovate image. It uses Renovate's real regex extractor, rejects untracked workload version variables and literal image pins outside version files, checks every external chart reference, and verifies OCA/SuiteCRM digest extraction. It reads only Git-visible paths, excluding ignored credentials. Run the same checks locally from the repository root:

```bash
renovate_tag="$(sed -n 's/^  RENOVATE_IMAGE_TAG: //p' apps/variables.yaml)"
docker run --rm --volume "$PWD:/workspace:ro" --workdir /workspace \
  --entrypoint renovate-config-validator "ghcr.io/renovatebot/renovate:$renovate_tag" renovate.json
docker run --rm --volume "$PWD:/workspace:ro" --workdir /workspace \
  --entrypoint node "ghcr.io/renovatebot/renovate:$renovate_tag" tools/check-renovate-coverage.mjs
```

Extraction proves discovery, not upstream registry access or PR creation. Check the Dependency Dashboard for lookup failures and rate-limited updates. In particular, a private/custom image without readable tags needs package visibility or read permissions fixed before Renovate can propose an update. No configuration can guarantee a PR for an upstream release that has not been published to the configured datasource.

## Deploy and verify

Follow the [application workflow](/admin-guide/deploy-an-application/). Publish to `main` through the approved repository workflow; the root app-of-apps discovers Renovate automatically. Local edits alone do not deploy it. Config and sealed credentials are wave `0`; the CronJob is wave `1`.

```bash
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application renovate
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n renovate get sealedsecret,cronjob,jobs,pods
```

Verify the SealedSecret is synced, then inspect the latest Job and its logs. A CronJob existing without a completed run does not prove authentication or repository processing. The real workflow is an onboarding or dependency-update pull request from `antblu-renovate[bot]` in an eligible repository; a run can legitimately finish without opening a PR if nothing needs updating.

For an immediate run, first ensure no scheduled or manual Job is active. Manual Jobs bypass the CronJob's overlap guard. The following command can create GitHub branches, issues, and pull requests:

```bash
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n renovate create job --from=cronjob/renovate renovate-manual-$(date +%s)
```

## Maintenance and failure handling

- GitHub App authentication failures: verify the private key belongs to the configured App, the installation remains active, and the App has the [upstream required permissions](https://docs.renovatebot.com/modules/platform/github/#running-as-a-github-app). Do not log keys, JWTs, or installation tokens.
- Missing repositories: review installation access, archived/fork handling, and repository Renovate configuration. New repositories use the normal onboarding flow.
- Failed or timed-out runs: inspect Job events and logs. The Job permits one retry and has a total 50-minute deadline, below the one-hour installation-token lifetime. Increasing that deadline requires token-refresh support; split repository batches if runs outgrow the budget.
- Failed node: temporary clones/cache are disposable. Kubernetes can start a replacement pod on another eligible node; the next hourly run also starts from scratch. No volume restoration is required.
- Suspend routine runs by setting `spec.suspend: true` in the CronJob source and publishing it. Suspension does not stop an already running Job.

Successful Job history is limited to one and failed history to three, with finished Jobs eligible for cleanup after 24 hours. Capture needed diagnostics before cleanup.

This page describes repository configuration, not live deployment evidence. See [Renovate's hosting guidance](https://docs.renovatebot.com/getting-started/running/) for the hourly CLI execution model.
