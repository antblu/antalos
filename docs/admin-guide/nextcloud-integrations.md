---
title: "Nextcloud identity and companion integrations"
description: "Finish OIDC, office editing, Whiteboard, push, Context Chat, mail, and Talk after deploying Nextcloud."
---

Start with the [Nextcloud deployment guide](/admin-guide/nextcloud/). The web server, database, Redis, shared app code, and object bucket must be usable before configuring companion features.

## Know which settings Git owns

The chart’s `postStartCommand` enables apps and reapplies selected integration settings. Editing those values only in the UI can work temporarily and then be overwritten at the next pod start.

| Integration | Supplied by manifests/startup | Finish after deployment |
| --- | --- | --- |
| OIDC | Pinned `user_oidc` app | Authentik provider, Nextcloud provider settings, user mapping |
| notify_push | Sidecar, `/push` route, base endpoint | Functional client/push test |
| EuroOffice | Two backends, URLs, JWT and header | Trusted connectivity, document editing and save test |
| Whiteboard | Two backends, public URL, JWT, Redis | Cross-user collaboration and recording/storage behavior |
| Context Chat | Request/update/indexing roles, database, manual AppAPI registration | AI/provider settings and permission-aware indexing/query test |
| Talk | Two backend pods, NATS, signaling and TURN settings | Public/internal DNS, router ports, cross-network calls |
| Talk recording | External service only | External URL, secret, TLS, storage, recording configuration |
| Mail / AI provider credentials | Applications enabled | Mail accounts, model endpoints, and credential policy |

## OIDC and account provisioning

1. Sign in using the local Nextcloud administrator from the initial deployment and retain that recovery path.
2. In Authentik, create an application/provider with the intended access binding, stable slug, and the standard identity scopes.
3. In Nextcloud’s OpenID Connect administration, create the matching provider with its client ID, secret, and discovery document.
4. Register the exact callback URI required by the installed `user_oidc` app, accounting for your web-server rewrite configuration. Do not use the issuer URL as the callback.
5. Choose the stable user identifier, display-name/email mappings, and group provisioning policy. Test a new user and an existing account before enabling broad automatic linking.
6. Confirm that the ordinary user sees only their own files and intended shares.

Provider settings are stored in application state and belong in the database recovery set. If managing them through CLI automation, seal the credential in `apps/nextcloud/` and consume it without embedding plaintext in a tracked script. The [upstream user_oidc documentation](https://github.com/nextcloud/user_oidc) describes CLI provider management and identity mapping for the installed version.

## Office editing

The startup hook sets `DocumentServerUrl` to the public office origin, an internal URL for Nextcloud-to-office traffic, and `StorageUrl` to Nextcloud’s public origin. It also configures the JWT secret and the `AuthorizationJWT` header.

Both directions matter: Nextcloud must reach the document server, and the document server must fetch and save documents through Nextcloud. Align the `EUROOFFICE_HOST` DNS/TLS route and the `eurooffice-jwt-secret` in `nextcloud-companion-secrets` with the backend. Do not add a browser login challenge to server-to-server document callbacks.

Open the same document as two permitted users, make edits, close it, and reopen it to confirm saving. A working office landing page alone does not exercise storage callbacks. The hook clears a saved `settings_error` so the next attempt can retry; clearing that flag does not itself prove the backend is healthy.

## Whiteboard and push

Whiteboard receives its external collaboration URL and JWT from the startup hook and uses Redis for shared live state. Confirm that both users see strokes in the same board and that reconnecting preserves the expected session behavior. Recording files use shared NFS, so account for them in backups rather than calling every file on the app export reconstructable.

notify_push runs alongside each Nextcloud web container and is exposed under `/push`. Test through a desktop client that supports it. If file operations work but notifications lag, inspect the push route and sidecar separately from core web readiness.

## Context Chat and AI providers

Kubernetes manages the three backend roles directly. AppAPI registers `context_chat_kubernetes` as a **manual-install** daemon and `context_chat_backend` as the external app. This registration is not a Docker/HaRP deployment endpoint and is deliberately not used as the default daemon for arbitrary app installation.

The request, update, and indexing roles each have their own replica setting and share the declared PostgreSQL database. Keep the backend version, launcher revision, Secret, port, and public Nextcloud URL consistent. The startup hook retries registration until the backend is available.

Configure the desired AI provider in Nextcloud’s administration after deployment. For a LiteLLM integration, use the gateway’s model aliases and a scoped virtual key. Index a small permitted document, ask a question about it, then test with an identity that lacks access. The existence of a search backend does not by itself prove that all permissions and provider settings are correct.

## Talk and recording

Follow the [Talk networking runbook](/admin-guide/nextcloud-talk/). Signaling and TURN endpoints are reapplied by the lifecycle hook, so persist changes in the shared variables and sealed Talk credentials.

Recording runs on the Ansible-managed `debian-arc` VM. The same playbook deploys
the recorder and writes Talk's `recording_servers` setting without exposing the
shared secret in Git. Test a complete recording and playback workflow after each
recorder or Talk upgrade.

The manually managed `live_transcription` container runs by itself on the
Ansible-managed `debian-left` VM using its pinned CPU image. The manually
managed `translate2` container runs beside llama.cpp on `debian-rtx` and uses
the passed-through RTX 3060 through CUDA. Each ExApp is registered against its
own direct AppAPI manual deployment on the internal network, so the former HaRP
container and `/exapps/` ingress are no longer used. The Arc VM remains
responsible for Talk recording, Immich machine learning, Jellyfin, and Docling.

## Mail and background work

Configure server-level SMTP for notifications and user-level mail accounts where the Mail app is used. These are different settings. The declared Stalwart service can provide mail, but creating the mailbox and matching its credential remain administrator work.

Background jobs are configured for cron, and startup also launches task-processing workers. Check job progress after enabling integrations; a successful web request does not prove indexing, notifications, or scheduled tasks are executing.

## Read-only status inspection

Discover the current pods instead of copying a historical pod name:

```bash title="Find the current Nextcloud replicas"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n nextcloud get pods -l app.kubernetes.io/name=nextcloud -o wide
```

Select one current pod, then inspect status:

```bash title="Inspect application status"
NEXTCLOUD_POD='REPLACE_WITH_CURRENT_POD'
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n nextcloud exec "$NEXTCLOUD_POD" -c nextcloud -- \
  su -s /bin/sh www-data -c 'php /var/www/html/occ status'
```

Use the [upgrade runbook](/admin-guide/nextcloud-upgrades/) when a command needs to modify the generated read-only configuration or migrate the database.
