---
title: "Zammad \u00b7 Deployment and Admin Guide"
description: "Deploy Zammad with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="Zammad guide sections"><a href="/user-guide/zammad/">Overview and User Guide</a><a href="/infrastructure/zammad/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/zammad/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/zammad/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Set `ZAMMAD_*` variables, including database, Redis, Elasticsearch, S3, and ingress. Prepare CNPG, OpenEBS, Garage, and RTX quorum capacity.

2. Reseal the Secret documents in `secrets.yaml`. Wait for the chart’s init/migration job before evaluating Rails readiness.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application zammad

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n zammad get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

The manifests do not configure a native OIDC provider. Complete the initial administrator wizard, then use Zammad’s supported third-party authentication settings for the deployed version. If integrating Authentik, copy the callback or service-provider metadata supplied by Zammad into the provider, configure the corresponding client secret or signing certificate, and map identities deliberately. Keep a local administrator until role and group access work for ordinary users.

## 4. Connect and operate the service

1. Configure support groups, roles, business hours, ticket states, and inbound/outbound email channels. Use a dedicated mailbox credential.

2. Send a message from an external mailbox, confirm ticket creation, reply, and confirm delivery. Exercise an attachment and search.

3. Establish database/object backups and document recovery of scheduled and real-time processing.

## 5. Maintain and recover

Back up PostgreSQL, Garage objects, and application credentials. Elasticsearch indexes can be rebuilt from authoritative application data using the upstream procedure, but search remains degraded until rebuilding completes. Preserve identity and email-channel configuration stored in the database.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

If Argo remains Progressing while Rails serves traffic, inspect the current init Job, ownerReferences, and hook status. For missing email, inspect scheduler and channel errors. For search failures, inspect Elasticsearch quorum and indexing separately from ticket storage.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/zammad/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/zammad/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/zammad/database.yaml)
- [`elasticsearch.yaml`](https://github.com/antblu/antalos/blob/main/apps/zammad/elasticsearch.yaml)
- [`redis.yaml`](https://github.com/antblu/antalos/blob/main/apps/zammad/redis.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/zammad/secrets.yaml)

[Official Zammad documentation](https://user-docs.zammad.org/en/latest/).
