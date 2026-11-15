---
title: "Accounts and access"
description: "Sign in, understand application permissions, and get help with access problems."
---

antalos uses Authentik as its central identity service. Check the application’s guide for the sign-in method it expects.

## Sign in for the first time

1. Open the service URL supplied by your administrator. Use the expected HTTPS hostname.
2. If redirected to Authentik, sign in and complete the configured multifactor step.
3. Return to the original service and confirm your displayed identity.
4. Request the application role or group you need for administrator, project, mailbox, or vault access.

Authentik uses access policy to decide which applications appear in your portal. If a tile is missing, ask your administrator to check your assignment. The application checks your access even if you open it by URL.

## Which account does a service use?

| Service | What the manifests configure |
| --- | --- |
| Argo CD, Headscale/Headplane, Open WebUI | Native OIDC through Authentik, subject to matching provider setup |
| SuiteCRM | SAML through Authentik |
| Traefik dashboard, BentoPDF, UrBackup UI | Authentik forward-auth at ingress; each hostname needs an outpost route/provider |
| Nextcloud | OIDC app installed; provider configuration completed by the administrator |
| LiteLLM | Administration credentials and application virtual keys |
| Vaultwarden | Its own vault account; administrator invitation required |
| Rancher, Grafana, Zammad, Stalwart | Application administration; external SSO is not declared in these manifests |
| RustDesk OSS | Server public key plus remote-device authorization |
| Obsidian LiveSync | Authentik-protected database endpoint; administrator must supply a working sync-client authentication method |
| Uptime Kuma | Administrator account for configuration; public status pages only when published |
| CrowdSec and cluster foundations | Background services, not ordinary user accounts |
| Documentation | Public static content in the checked-in ingress |

## Keep recovery available

Set up the account’s supported recovery options. Keep recovery passwords and multifactor codes somewhere you can reach during a cluster outage.

For native clients, follow the app-specific token, app-password, or device-login procedure. An identity-provider browser password may not work in a mail, DAV, Git, vault, or remote-desktop client.

## Report the useful details

Record the service hostname, approximate time, error text, and whether the problem occurs before or after returning from Authentik. Include whether an existing session still works. Do not send passwords, tokens, callback query strings, or full authentication traces containing credentials.

An administrator can use the [SSO runbook](/admin-guide/single-sign-on/) to distinguish callback, provider, account-linking, and permission failures.

## Official help

Use [Authentik's user documentation](https://docs.goauthentik.io/) for identity features and the **Official documentation** section in each [service guide](/user-guide/services/) for application-specific sign-in and recovery. Your administrator determines which methods are enabled in this installation.
