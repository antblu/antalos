---
title: "GitLab \u00b7 Overview and User Guide"
description: "What GitLab does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="GitLab guide sections"><a aria-current="page" href="/user-guide/gitlab/">Overview and User Guide</a><a href="/infrastructure/gitlab/">Infrastructure Explanation</a><a href="/admin-guide/gitlab/">Deployment and Admin Guide</a></nav>

GitLab brings Git repositories, merge requests, issue tracking, a container registry, and CI/CD project configuration into one workspace. Antalos also exposes GitLab’s Kubernetes agent endpoint. Runner execution is a separate integration: a project can define a pipeline before any runner is available to execute it.

## Access and audience

The public address is defined by `GITLAB_HOST` in `apps/variables.yaml`. Use your deployment’s value; Antalos hostnames are examples for a fork.

## Your first workflow

1. Sign in at the GitLab web endpoint using the configured antID provider, then select or create a project according to your permissions.

2. Add your SSH public key to your profile or use the project’s HTTPS clone URL with an appropriate access token. Clone the URL shown by GitLab.

3. Create a branch, make a focused change, push it, and open a merge request. Use review discussion and pipeline results before merging.

4. Use issues for work tracking and the registry for project images. Scope tokens to the project and actions they need; do not use the administrator account for routine automation.

## When you need an administrator

For a stuck initialization, examine the current chart hook and its dependency rather than deleting every old Job. For repository failures, inspect Gitaly and Praefect quorum as well as Rails. For object failures, test the relevant prefix permissions and S3 endpoint.

## Availability when using this service

**Partially HA as a complete service: extensive replication, with external storage and failover/recovery prerequisites.** Paired application roles, one instance of each PostgreSQL cluster, one Redis data member, and two repository members can remain. Both surviving Sentinel voters must communicate correctly. The remaining worker and RTX also need enough CPU, memory, and disk headroom for degraded operation.

Read [how redundancy and recovery work](/infrastructure/gitlab/#availability-and-failure-behavior), including upgrade interruptions and external dependencies. These are design expectations, not a live status indicator.

## Official documentation

Use the [official GitLab documentation](https://docs.gitlab.com/user/) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/gitlab/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/gitlab/).
