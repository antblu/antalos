---
title: "antalos documentation · Operate"
description: "Deploy antalos documentation with antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="antalos documentation guide sections"><a href="/user-guide/docs/">Use</a><a href="/infrastructure/docs/">Architecture</a><a aria-current="page" href="/admin-guide/docs/">Operate</a></nav>

This runbook deploys the service from `apps/docs/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## Build and publish

`.github/workflows/docs-image.yaml` builds `site/Dockerfile` from the repository root. The Docker build installs the pnpm version declared in `site/package.json`, uses `site/pnpm-lock.yaml` with `--frozen-lockfile`, then runs `astro check` and the static build. Node and nginx image tags come from `apps/variables.yaml`.

pnpm's default minimum release age remains enabled. `site/pnpm-workspace.yaml` lists exact release-age exceptions for the six Astro package versions already selected by the lockfile, allowing those releases to build during their first day. Future versions remain subject to the age gate. Review the lockfile and these exceptions together when updating dependencies.

## Continue

Read the [deployment guide](/admin-guide/docs/) for dependency order, initial credentials, and integration work. The [official documentation](https://starlight.astro.build/) explains the upstream product; the topology above describes this repository.
