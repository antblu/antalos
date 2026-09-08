---
title: "Stalwart Mail \u00b7 Deployment and Admin Guide"
description: "Deploy Stalwart Mail with Antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="Stalwart Mail guide sections"><a href="/user-guide/stalwart/">Overview and User Guide</a><a href="/infrastructure/stalwart/">Infrastructure Explanation</a><a aria-current="page" href="/admin-guide/stalwart/">Deployment and Admin Guide</a></nav>

This runbook deploys the service from `apps/stalwart/` and completes the configuration that Kubernetes cannot supply by itself. Start with the [shared deployment workflow](/admin-guide/deploy-an-application/) for repository rendering, credentials, and Argo CD ownership.

## 1. Prepare dependencies and inputs

1. Set `MAIL_HOST`, `MAIL_DOMAIN`, Garage, database, Redis, and Elasticsearch variables. Prepare CNPG, OpenEBS, object storage, and all required mail protocol routes.

2. Prepare DNS for the mail hostname and domain, plus reverse DNS and the mail authentication records required by your delivery policy. DNS and public network changes are outside these Kubernetes manifests.

3. Reseal storage, Redis, and bootstrap credentials. The recovery administrator credential must follow the image’s expected `username:password` contract, not contain only the password.

## 2. Reconcile the application

Publish the reviewed manifests and shared variables to the branch tracked by your Argo CD Applications. Local edits are not deployment inputs until that branch contains them. Let the root app-of-apps discover this service and retain its declared hook order; do not apply files containing unresolved variable placeholders directly.

From the repository root, inspect the Application and its namespace:

```bash title="Inspect deployment state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n argocd get application stalwart

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n stalwart get pods,svc,pvc
```

Wait for required controllers, database initialization, and migration Jobs before testing the user workflow. Synced configuration, ready workloads, and a successful user transaction are separate milestones.

## 3. Complete identity and first access

The manifests bootstrap a local Stalwart administrator; they do not configure Authentik OIDC. Establish the administrator through the `stalwart-bootstrap-admin` Secret workflow, then create the domain and mailbox accounts using the deployed version’s administration interface. Mail protocols need their own supported authentication and must remain reachable without an interactive ingress login.

## 4. Connect and operate the service

1. Complete domain setup and publish the DNS records generated or required by Stalwart. Test inbound and outbound delivery from an unrelated mail system.

2. Create the mailbox used by Authentik’s SMTP configuration and test an Authentik email. Configure relay policy deliberately before onboarding applications.

3. Verify TLS on every exposed mail protocol, mailbox search, object storage writes, and the database backup/restore procedure.

## 5. Maintain and recover

Back up PostgreSQL, Garage message blobs, sealed credentials, signing material, and declarative bootstrap configuration. Mail identity also depends on external DNS records. Replicated search and cache components are not independent backups of mailboxes.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Troubleshooting

For bootstrap 401 responses, verify the administrator Secret format and the active recovery-auth configuration without printing the credential. For mail delays, inspect queue and delivery errors, DNS, and upstream reachability. A healthy HTTPS page does not prove SMTP delivery.

## Manifest and upstream reference

- [`app.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/app.yaml)
- [`certificate.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/certificate.yaml)
- [`database.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/database.yaml)
- [`elasticsearch.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/elasticsearch.yaml)
- [`redis.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/redis.yaml)
- [`secrets.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/secrets.yaml)
- [`stalwart.yaml`](https://github.com/antblu/antalos/blob/main/apps/stalwart/stalwart.yaml)

[Official Stalwart Mail documentation](https://stalw.art/docs/).
