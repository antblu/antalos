---
title: "antalos documentation · Operate"
description: "Deploy antalos documentation with antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="antalos documentation guide sections"><a href="/user-guide/docs/">Use</a><a href="/infrastructure/docs/">Architecture</a><a aria-current="page" href="/admin-guide/docs/">Operate</a></nav>

This runbook deploys the service from `apps/docs/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## Build and publish

`.github/workflows/docs-image.yaml` defaults to a GitHub-hosted Ubuntu runner to build `site/Dockerfile` from the repository root. The Docker build installs the pnpm version declared in `site/package.json`, uses `site/pnpm-lock.yaml` with `--frozen-lockfile`, then runs `astro check` and the static build. Node and nginx image tags come from `apps/variables.yaml`.

pnpm's default minimum release age remains enabled. `site/pnpm-workspace.yaml` lists exact release-age exceptions for the six Astro package versions already selected by the lockfile, allowing those releases to build during their first day. Future versions remain subject to the age gate. Review the lockfile and these exceptions together when updating dependencies.

Publish `site/package.json` and `site/pnpm-lock.yaml` together for dependency upgrades. After editing dependency versions, run `pnpm install --lockfile-only` from `site/` using its declared pnpm version, then verify `pnpm install --frozen-lockfile` and the documentation image build. A manifest-only upgrade fails with `ERR_PNPM_OUTDATED_LOCKFILE`; retain the frozen install so CI cannot silently resolve a different dependency tree.

## Runner selection

Pushes and pull requests use `ubuntu-latest`. In GitHub Actions → Build documentation image → Run workflow, select either `ubuntu-latest` or `self-hosted`. The latter requires an online runner registered to `antblu/antalos`; it does not fall back automatically if the runner is offline or busy. Both runner types need Docker, which the hosted image supplies. GitHub treats multiple `runs-on` labels as requirements for a single runner, not alternatives.

The existing workstation listener at `/home/antblu/actions-runner` is registered to Antalos as `AnthonyPC`. Repository-level runners cannot serve a second repository. Because `antblu` is a personal account, sharing this workstation with Emiliany requires a second listener in a separate installation/work directory, registered to `antblu/emiliany` (for example `AnthonyPC-emiliany`). Preserve the existing registration and listener. Follow [GitHub's runner setup](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners) from each repository's Settings → Actions → Runners. Registration credentials stay on the workstation. Organization-level runner sharing would require repositories owned by an organization instead.

## Automatic website updates

A successful build on `main` publishes the `ghcr.io/antblu/antalos-docs:main` production channel and a commit tag. Pull requests and manual runs on other branches do not publish production images. GitHub cache export is best effort; a cache-service failure does not invalidate a successful image publication.

The shared `apps/website-image-refresh/` Application runs a small CronJob every minute on an eligible worker. It reads the image selected by each website Deployment and compares its GHCR manifest digest with the pod-template annotation `images.antblu.net/published-image`. A changed digest updates that annotation, triggering a rolling replacement; `imagePullPolicy: Always` makes each replacement resolve the published tag. Allow the polling interval plus rollout time. Rapid publications converge to the newest channel image and can supersede intermediate releases.

Docs uses anonymous registry reads. Its service-owned `image-refresh-rbac.yaml` grants the refresh ServiceAccount only `get` and `patch` on the named docs Deployment. Emiliany separately grants access to its own Deployment and registry Secret. The refresh account cannot list Secrets or modify other Deployments. Both Applications ignore only the refresh annotation and respect that exception during sync; Argo CD continues to own image selection, replicas, and rollout settings. Renovate leaves these two website channel tags unpinned so digest pinning cannot silently stop automatic updates.

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
