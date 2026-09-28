---
title: "GitLab · Use"
description: "What GitLab does, how to use it in antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="GitLab guide sections"><a aria-current="page" href="/user-guide/gitlab/">Use</a><a href="/infrastructure/gitlab/">Architecture</a><a href="/admin-guide/gitlab/">Operate</a></nav>

GitLab brings Git repositories, merge requests, issue tracking, a container registry, and CI/CD project configuration into one workspace. antalos also exposes GitLab's Kubernetes agent endpoint. Runner execution is a separate integration: a project can define a pipeline before any runner is available to execute it.

## Access and audience

For this installation, use [gitlab.antblu.net](https://gitlab.antblu.net). If you use another antalos installation, open the address supplied by its administrator. Ask for the account or role you need before starting.

## Your first workflow

1. Sign in at the GitLab web endpoint using the configured antID provider, then select or create a project according to your permissions.

2. Add your SSH public key to your profile or use the project’s HTTPS clone URL with an appropriate access token. Clone the URL shown by GitLab.

3. Create a branch, make a focused change, push it, and open a merge request. Use review discussion and pipeline results before merging.

4. Use issues for work tracking and the registry for project images. Scope tokens to the project and actions they need; do not use the administrator account for routine automation.

## Get help

Include the project, the action that failed, and the relevant job or error. A clone, push, pipeline, and registry upload follow different paths. Redact access tokens and private repository content from screenshots.

## During an interruption

A brief interruption can affect pushes, pipelines, or repository browsing differently. Check the result of a write before repeating it.

Administrators can read [the architecture and recovery limits](/infrastructure/gitlab/#availability-and-failure-behavior).

## Official documentation

Use the [official GitLab documentation](https://docs.gitlab.com/user/) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/gitlab/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/gitlab/).
