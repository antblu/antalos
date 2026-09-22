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
