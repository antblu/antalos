---
title: "Accounts and access"
description: "Sign in, understand application permissions, and get help with access problems."
---

Authentik is the central identity service, but applications can use different sign-in methods. Follow the application’s user guide rather than assuming that every login form expects the same credentials.

## Sign in for the first time

1. Open the service URL supplied by your administrator. Use the expected HTTPS hostname.
2. If redirected to Authentik, sign in and complete the configured multifactor step.
3. Return to the original service and confirm your displayed identity.
4. Request the application role or group you need. Successful login alone does not grant administrator, project, mailbox, or vault access.

The identity portal displays application tiles based on access policy. A missing tile can indicate missing assignment; opening a known URL still requires the application’s own access checks.

## Which account does a service use?

| Service | What the manifests configure |
| --- | --- |
| Argo CD, GitLab, Headscale/Headplane, Open WebUI | Native OIDC through Authentik, subject to matching provider setup |
| SuiteCRM | SAML through Authentik |
| Traefik dashboard, BentoPDF, UrBackup UI | Authentik forward-auth at ingress; each hostname needs an outpost route/provider |
| Nextcloud | OIDC app installed; provider configuration completed by the administrator |
| LiteLLM | Administration credentials and application virtual keys |
| Vaultwarden | Its own vault account; administrator invitation required |
| Rancher, Grafana, Zammad, Stalwart | Application administration; external SSO is not declared in these manifests |
| RustDesk OSS | Server public key plus remote-device authorization |
| Documentation | Public static content in the checked-in ingress |

## Keep recovery available

Use the account’s supported recovery options and retain multifactor recovery material independently of the cluster. A password stored only in a service that is currently unavailable cannot help restore that service.

For native clients, follow the app-specific token, app-password, or device-login procedure. An identity-provider browser password may not work in a mail, DAV, Git, vault, or remote-desktop client.

## Report the useful details

Record the service hostname, approximate time, error text, and whether the problem occurs before or after returning from Authentik. Include whether an existing session still works. Do not send passwords, tokens, callback query strings, or full authentication traces containing credentials.

An administrator can use the [SSO runbook](/admin-guide/single-sign-on/) to distinguish callback, provider, account-linking, and permission failures.
