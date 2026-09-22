---
title: "Renovate · Use"
description: "Review dependency updates proposed by the antblu-renovate GitHub App."
---

<nav class="guide-switcher" aria-label="Renovate guide sections"><a aria-current="page" href="/user-guide/renovate/">Use</a><a href="/infrastructure/renovate/">Architecture</a><a href="/admin-guide/renovate/">Operate</a></nav>

Renovate scans repositories accessible to the `antblu-renovate` GitHub App installation each hour. Work happens in GitHub; there is no separate website or account to sign into.

For a newly enabled repository, review the onboarding pull request from `antblu-renovate[bot]`. The suggested configuration extends `config:recommended`. After onboarding, review dependency-update pull requests and their CI results using the repository's normal review process. Repository Renovate configuration controls grouping, scheduling, and any opt-in automerge behavior.

To add or remove a repository, ask the GitHub App installation owner to change its repository access. An operator can check [Job status and authentication](/admin-guide/renovate/) if expected updates do not appear. This is a scheduled, non-HA job: an interrupted run may delay updates until a retry or later schedule.
