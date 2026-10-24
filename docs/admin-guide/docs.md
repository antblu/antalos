---
title: "antalos documentation · Operate"
description: "Deploy antalos documentation with antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="antalos documentation guide sections"><a href="/user-guide/docs/">Use</a><a href="/infrastructure/docs/">Architecture</a><a aria-current="page" href="/admin-guide/docs/">Operate</a></nav>

This runbook deploys the service from `apps/docs/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## Build and publish

`.github/workflows/docs-image.yaml` automatically prefers a ready self-hosted runner, with a GitHub-hosted Ubuntu fallback, to build `site/Dockerfile` from the repository root. The Docker build installs the pnpm version declared in `site/package.json`, uses `site/pnpm-lock.yaml` with `--frozen-lockfile`, then runs `astro check` and the static build. Node and nginx image tags come from `apps/variables.yaml`.

pnpm's default minimum release age remains enabled. `site/pnpm-workspace.yaml` lists exact release-age exceptions for the six Astro package versions already selected by the lockfile, allowing those releases to build during their first day. Future versions remain subject to the age gate. Review the lockfile and these exceptions together when updating dependencies.

Publish `site/package.json` and `site/pnpm-lock.yaml` together for dependency upgrades. After editing dependency versions, run `pnpm install --lockfile-only` from `site/` using its declared pnpm version, then verify `pnpm install --frozen-lockfile` and the documentation image build. A manifest-only upgrade fails with `ERR_PNPM_OUTDATED_LOCKFILE`; retain the frozen install so CI cannot silently resolve a different dependency tree.

## Runner selection

Documentation, Mautic, and Medusa image builds and the Renovate dependency-coverage check use `.github/workflows/select-runner.yaml`. Push builds prefer a ready self-hosted runner. Pull requests use GitHub-hosted Ubuntu. Manual Run workflow requests offer `auto` (the default), `ubuntu-latest`, and `self-hosted`.

The selection job runs on GitHub-hosted Ubuntu and dispatches `runner-probe.yaml` with its short-lived Actions token. The probe targets the repository's `self-hosted`, `Linux`, `X64`, and `antalos` labels and checks that Docker responds. A successful response within the roughly 60-second readiness window selects those labels for the build. A busy/offline runner, failed Docker check, or probe API failure selects `ubuntu-latest`. Unfinished probes are cancelled after selection on a best-effort basis. No administrator PAT is required; the selection job has only `actions: write`, separate from build permissions.

Manual `self-hosted` explicitly waits for the workstation; it does not fall back. Availability is checked before scheduling and does not reserve the runner. If it disconnects or becomes busy after a successful probe, the build can still queue; rerun with `ubuntu-latest` to bypass it. Publish the selector, probe, and calling workflows to the default branch together. Local edits do not activate this behavior.

Native authorization reconciliation remains self-hosted because it needs the local repository and infrastructure credentials. Its five-minute schedule can occupy the same listener; portable builds can fall back rather than wait indefinitely behind it.

Run `node .github/tests/select-runner.cjs` from the repository root for nine selection scenarios, and run `actionlint` for workflow syntax. `.github/actionlint.yaml` declares the custom `antalos` label.

Repository-level runners serve only the repository where they are registered. To
reuse a workstation for another repository, register a separate listener in its
own installation and work directory. Preserve existing listeners and keep
registration credentials on the workstation. See [GitHub's runner setup](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners).

## Automatic website updates

A successful build on `main` publishes the `ghcr.io/antblu/antalos-docs:main` production channel and a commit tag. Pull requests and manual runs on other branches do not publish production images. GitHub cache export is best effort; a cache-service failure does not invalidate a successful image publication.

The shared `apps/website-image-refresh/` Application runs a small CronJob every minute on an eligible worker. It reads the image selected by each website Deployment and compares its GHCR manifest digest with the pod-template annotation `images.antblu.net/published-image`. A changed digest updates that annotation, triggering a rolling replacement; `imagePullPolicy: Always` makes each replacement resolve the published tag. Allow the polling interval plus rollout time. Rapid publications converge to the newest channel image and can supersede intermediate releases.

Docs uses anonymous registry reads. Its service-owned `image-refresh-rbac.yaml` grants the refresh ServiceAccount only `get` and `patch` on the named docs Deployment. Other websites declare their own scoped Deployment permissions and, when needed, registry Secret access. The refresh account cannot list Secrets or modify other Deployments. Participating Applications ignore only the refresh annotation and respect that exception during sync; Argo CD continues to own image selection, replicas, and rollout settings. Renovate leaves website production channel tags unpinned so digest pinning cannot silently stop automatic updates.

Docs rolls with zero surge and one unavailable replica, allowing updates with its two existing eligible worker slots. At least one ready replica remains during a healthy rollout. A failed image cannot establish a successful rollout; inspect readiness and public requests separately from a successful refresh Job.

Publish the shared Application, service RBAC, Application ignore rule, and Deployment strategy through Antalos `main`. They are deployment prerequisites, not live state established by a local edit. Inspect the Jobs and actual serving replicas:

```bash
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n website-image-refresh get cronjob,jobs,pods
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n website-image-refresh logs job/<job-name>
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig -n docs rollout status deployment/docs
curl --fail https://docs.antblu.net/healthz
```

A first successful check establishes the digest annotation and requests one rollout. Unchanged images do not restart pods. Registry/authentication failures leave the current pods untouched; the next scheduled Job retries. Each website is checked independently. If a source update races a refresh, Kubernetes rejects the stale resource version and the next run retries.

For rollback, select a retained commit tag in `DOCS_IMAGE_TAG` and publish the shared input. To freeze a digest, use `main@sha256:<digest>`; the refresh Job skips digest-pinned images. Returning to `main` resumes the production channel. The annotation records the digest observed when requesting replacement; verify running pod image IDs for actual rollout evidence.

## Continue

Read the [deployment guide](/admin-guide/docs/) for dependency order, initial credentials, and integration work. The [official documentation](https://starlight.astro.build/) explains the upstream product; the topology above describes this repository.
