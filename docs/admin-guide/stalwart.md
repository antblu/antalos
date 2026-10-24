---
title: "Stalwart Mail · Operate"
description: "Deploy Stalwart Mail with antalos manifests, complete identity and integrations, and maintain its data."
---

<nav class="guide-switcher" aria-label="Stalwart Mail guide sections"><a href="/user-guide/stalwart/">Use</a><a href="/infrastructure/stalwart/">Architecture</a><a aria-current="page" href="/admin-guide/stalwart/">Operate</a></nav>

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

The manifests bootstrap a local Stalwart administrator and reuse an Authentik OIDC directory by issuer, selecting it for authentication. The dedicated `stalwart_groups` claim maps only the users/admins mail groups; the mail groups alone do not confer system administration in Stalwart v0.16.27. The native role synchronizer sets an existing matched account to `Admin` when its Authentik effective groups include `stalwart-admins`, and to `User` otherwise. Establish the administrator through the `stalwart-bootstrap-admin` Secret workflow, then create the domain and mailbox accounts using the deployed version’s administration interface. Mail protocols need their own supported authentication and must remain reachable without an interactive ingress login.

### Migrate existing direct roles

The OIDC directory synchronizes group membership at login. Existing direct
administrator roles must also be migrated, since adding a standard-user group
does not remove a direct administrator grant. From the repository root, forward
the existing HTTP Service and run the account migration:

```bash
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n stalwart port-forward service/stalwart-web 18080:8080
```

In another terminal:

```bash
python3 apps/stalwart/tools/reconcile-access.py
python3 apps/stalwart/tools/reconcile-access.py --apply
```

The first invocation prints a plan. The second matches exact Authentik-managed
email addresses, looks up the active directory, mail domain and built-in role,
creates or updates the two owned mail groups, enables the scoped claim, and
synchronizes matched accounts to the native `Admin` or `User` role from effective
Authentik membership. Removing admin membership, removing all Stalwart membership,
or disabling the Authentik identity demotes the native account to `User` and
removes the owned admin-group membership.
It preserves credentials, unrelated memberships, accounts and providers. It
refuses ambiguous identities or explicit account permissions that require
review. Bootstrap credentials are read privately from the existing Secret and
are never printed. Settings reload follows an actual change. The existing
`.github/workflows/authorization-sync.yaml` controller runs this reconciliation
every five minutes using a temporary loopback-only API tunnel. Runner queueing
and availability can delay changes. OIDC login independently updates group
membership; it does not set the native administrator role. Rerun the helper for
immediate role synchronization and sign in again to renew cached permissions.
The two EMILIANY accounts must belong only to the users mail
group, with native `User` roles and no administrator grant. Unmatched local
recovery accounts, credentials and unrelated memberships are preserved.

[Stalwart v0.16.27 permission construction](https://github.com/stalwartlabs/stalwart/blob/v0.16.27/crates/common/src/auth/access_token.rs)
uses the account role for system permissions and group IDs for resource ACLs.
The corrected mapping passed a privileged `Authentication/get` request using
`antblu`’s OIDC access token on 2026-10-24; the temporary token and Authentik
session were revoked afterward. Promotion, demotion, full membership removal,
and repeat-run behavior are covered by `apps/stalwart/tests/access-sync.py`. See
[application authorization](/admin-guide/authentik/#application-authorization).

## 4. Connect and operate the service

1. Complete domain setup and publish the DNS records generated or required by Stalwart. Test inbound and outbound delivery from an unrelated mail system.

2. Create the mailbox used by Authentik’s SMTP configuration and test an Authentik email. Configure relay policy deliberately before onboarding applications.

3. Verify TLS on every exposed mail protocol, mailbox search, object storage writes, and the database backup/restore procedure.

### Automatic Cloudflare DNS management

DNS providers and per-domain DNS management are configured in Stalwart and persisted in its database. Create a separate Cloudflare provider under **Settings → Network → DNS → DNS Providers** for each zone-scoped API token, then select that provider in the domain's automatic DNS management settings under **Management → Domains → Domains**. Keep tokens in Stalwart; do not put them in shared variables, manifests, or documentation. Include provider credentials in the protected database recovery plan.

Use the provider defaults: a 30-second request timeout, five-minute record TTL, 15-second polling interval, and one-minute propagation timeout. The default publication set covers DKIM, SPF, MX, DMARC, service discovery, MTA-STS, TLS reporting, CAA, and client autoconfiguration. Enable automatic DKIM management for signing-key generation and rotation. Keep the existing certificate-management workflow unless a separate certificate migration is intended.

Before enabling SPF publication, compare the generated policy with the existing record. Stalwart generates `v=spf1 mx -all`; a domain that also sends through Microsoft 365 or another service needs its additional authorization preserved. Exclude SPF from that domain's publication set and maintain its combined SPF policy separately. Do not publish a second SPF record.

Saving automatic DNS management schedules asynchronous `DnsManagement` tasks; automatic DKIM also schedules `DkimManagement`. Inspect scheduled and failed tasks and verify the resulting records at Cloudflare and public DNS. A saved domain setting alone is not proof of successful publication. The bootstrap domain upsert deliberately omits `dnsManagement` so later bootstrap runs preserve the provider selection and publication set managed in Stalwart.

See the official [DNS management lifecycle](https://stalw.art/docs/domains/dns-records/) and [DNS provider reference](https://stalw.art/docs/ref/object/dns-server/).

## Availability before maintenance

**Partially HA; loss of the RTX-only Redis proxy is an explicit single-worker failure gap.**

Stalwart’s StatefulSet updates its processes incrementally and has a PDB minimum 1. The Redis quorum/proxy Deployment uses Recreate, so updating that singleton can interrupt Redis access for both mail replicas.

Remove the single Redis client-path dependency through a supported replicated proxy or native discovery design, establish election/rejoin correctness, and record SMTP, mailbox read, search, and blob access during failure. Protect external storage and verify per-index shard allocation.

Use the [component-by-component failure contract](/infrastructure/stalwart/#availability-and-failure-behavior) before a node drain, database promotion, or upgrade. Restoring a healthy replica count must include data resynchronization and restored voting capacity, not just Running pods.

## 5. Maintain and recover

Back up PostgreSQL, Garage message blobs, sealed credentials, signing material, and declarative bootstrap configuration. Mail identity also depends on external DNS records. Replicated search and cache components are not independent backups of mailboxes.

Before an upgrade, read the release notes for the pinned target and record a recovery point. A previous image tag is not a database rollback after a schema migration. Use [routine operations](/admin-guide/operations/) and [disaster recovery](/admin-guide/disaster-recovery/) for the platform sequence.

## Mail routing and listeners

The public edge and home proxies are documented in [networking](/infrastructure/networking/) and [Azure edge deployment](/admin-guide/azure-edge/). Public mail traverses the Azure edge and one of the home HAProxy guests before reaching Stalwart. The Azure edge sends PROXY protocol v2, each home frontend accepts it, and each home backend sends PROXY v2 to a local Talos worker through the dedicated `stalwart-proxy` NodePort Service. Stalwart trusts PROXY headers only from the two home HAProxy addresses declared in `apps/variables.yaml`.

The source-preserving proxy path uses fixed NodePorts: SMTP `30025`, implicit TLS SMTP `30465`, submission `30587`, IMAPS `30993`, and ManageSieve `30190`. Firewall policy must allow both home HAProxy guests to reach those ports on both mail-worker nodes. Keep the shared `stalwart` MetalLB Service for direct internal clients; do not use that Cluster-policy VIP between the home proxies and Stalwart. Doing so source-NATs many public sessions to a cluster address, preventing per-client reputation controls and allowing one automatic block to affect all inbound mail.

When changing listener configuration, inspect the active application configuration after bootstrap and use the service's startup/rollout procedure. A Kubernetes Service mapping alone does not cause Stalwart to bind a port. Preserve the distinction between the HTTPS administration route and the mail-client protocols.

After changing any part of this path, test all five public ports and inspect Stalwart's connection events. The recorded remote address must be the public client address, not an Azure, home HAProxy, pod, or node address. Also inspect blocked-IP records before concluding that a reachable listener can accept mail.

## Trace a delayed message

1. Identify the submission time and message or queue identifier without collecting credentials.
2. Establish whether Stalwart accepted the submission and created a queue entry.
3. Read the delivery attempt and destination or configured relay. A queued message is not yet delivered.
4. For connection timeouts, inspect reachability from the affected pod and then its node to isolate the network boundary.
5. After the underlying problem is repaired, confirm a successful delivery result and a recipient-side round trip where available.

Relay authentication, DNS, outbound TCP access, recipient rejection, and local mailbox access can fail independently. Record the actual destination, port, and response rather than treating every delay as an ingress problem.

## Troubleshooting

The HTTP listener behind Traefik must keep `Http.useXForwarded` enabled, as declared in the bootstrap configuration, so visitor traffic is attributed to the forwarded client address. Port 8080 is internal; expose the web interface through the trusted ingress. Without forwarded client IPs, scanner requests can cause Stalwart to ban the Traefik pod addresses and return HTTP 502 for every visitor while readiness remains healthy. Check Stalwart's `security.ip-blocked` events against the current Traefik pod addresses, correct the HTTP setting, and remove only the corresponding proxy `BlockedIp` records. Verify the public account and administration pages afterward; do not clear unrelated client bans.

Bootstrap also upserts non-expiring `AllowedIp` entries for `KUBERNETES_POD_CIDR` and the two `STALWART_PROXY_TRUSTED_NETWORK_*` addresses. The pod-network entry covers Traefik after pod replacement; it also exempts other internal pods from automatic bans. Public clients retain their own forwarded addresses and remain subject to automatic bans. These allow entries do not grant authentication or relay permission and do not expand the networks trusted to send PROXY protocol headers.

After saving the correction, run the `ReloadSettings` and `ReloadBlockedIps` actions so settings and the in-memory allowed/blocked IP lists refresh across the mail replicas. Saving the objects alone does not prove the serving processes have loaded the change.

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
