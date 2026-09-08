---
title: "GitLab \u00b7 Deployment and Admin Guide"
description: "Deploy GitLab with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="GitLab guide sections"><a href="/user-guide/gitlab/">Overview and User Guide</a><a href="/infrastructure/gitlab/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/gitlab/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/gitlab/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Set `GITLAB_HOST`, `GITLAB_REGISTRY_HOST`, `GITLAB_KAS_HOST`, domain, OIDC, database, Redis, and volume variables. Route all three HTTPS names and Git SSH through the intended ingress path.

2. Prepare CNPG, OpenEBS, Garage credentials, and capacity on all three workers. Reseal every Secret document in `secrets.yaml`, preserving existing application keys during a restore.

3. Allow the chart’s dependency and migration jobs to finish before treating the webservice as ready.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application gitlab

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n gitlab get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

Native OIDC is configured through the `gitlab-oidc` Secret’s `provider` entry, with a separate `clientSecret` value. Configure an Authentik provider using `GITLAB_OIDC_ISSUER`, client ID, and the exact callback `https://<gitlab-host>/users/auth/openid_connect/callback`. Match `GITLAB_OIDC_CLIENT_AUTH_METHOD` and keep `sub` as the stable identity field. Changing the variables alone does not rebuild an encrypted provider document; reseal the provider configuration when its embedded settings change. The local bootstrap account is `root`, with its password in `gitlab-gitlab-initial-root-password`.

## 4. Connect and operate the service

1. Register a runner with appropriate project or group scope; the manifests do not register one for you. Keep its authentication token sealed if you later deploy it in Kubernetes.

2. Configure outbound mail before relying on notifications or password reset. SMTP is disabled in the current chart settings.

3. Create a test project, push and clone a commit, upload an attachment, push and pull a registry image, and connect an agent if KAS is needed.

4. Before enabling stock Helm backups, provision the separate buckets required by GitLab and rehearse restoration into isolated storage.

## Availability before maintenance

**Partially HA as a complete service: extensive replication, with external storage and failover/recovery prerequisites.**

Paired Deployments use zero surge and one unavailable; repository StatefulSets update incrementally. Run chart migrations in the declared order. A schema change or queue retry can affect availability even when a frontend pod remains Ready.

Establish Sentinel peer-authentication/election evidence, test repository correctness through loss and rejoin, protect Garage, and create a restorable backup covering both databases, repositories, objects, and application keys. Review the upstream support status of Gitaly Cluster on Kubernetes.

Use the [component-by-component failure contract](/infrastructure/gitlab/#availability-and-failure-behavior) before a node drain, database promotion, or upgrade. Restoring a healthy replica count must include data resynchronization and restored voting capacity, not just Running pods.

## 5. Maintain and recover

Recovery requires both PostgreSQL databases, the Gitaly repository data, Garage objects, and GitLab’s encryption, signing, SSH, and registry keys. The shared `gitlabs` bucket uses object prefixes and a registry prefix. Backup scheduling is disabled; this layout is incompatible with the stock Helm restore assumptions that require separate buckets.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

For a stuck initialization, examine the current chart hook and its dependency rather than deleting every old Job. For repository failures, inspect Gitaly and Praefect quorum as well as Rails. For object failures, test the relevant prefix permissions and S3 endpoint.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/gitlab/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/gitlab/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/gitlab/database.yaml)
- [`redis.yaml`](https://github.com/antblu/antalos/blob/main/apps/gitlab/redis.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/gitlab/secrets.yaml)

[Official GitLab documentation](https://docs.gitlab.com/user/).

Additional deployment references: [GitLab Helm chart](https://docs.gitlab.com/charts/), [Gitaly on Kubernetes](https://docs.gitlab.com/administration/gitaly/kubernetes/), and [object storage bucket separation](https://docs.gitlab.com/administration/object_storage/#use-separate-buckets).
