---
title: "Connect identity and application access"
description: "Configure Authentik OIDC, SAML, and forward-auth without confusing provider setup with application authorization."
---

SSO has two owners: Authentik decides who may authenticate, and the application decides what that identity may do. Finish both sides before considering an integration complete. The manifests often contain the relying-party settings, but the provider and policy bindings still need to exist in Authentik.

## Identify the configured protocol

| Integration | Repository configuration | Administrator work remaining |
| --- | --- | --- |
| Argo CD | Dex OIDC connector | Provider, callback, sealed client secret, Argo RBAC |
| GitLab | Native OIDC provider document in a Secret | Matching provider, callback, account-linking and project roles |
| Headscale and Headplane | Shared OIDC client, PKCE options | Both callbacks, allowed domain, Headplane admin role and backend API key |
| Open WebUI | OIDC discovery, client ID, sealed secret | Provider policy, callback, user/model permissions |
| Nextcloud | `user_oidc` installed | Provider definition in Authentik and Nextcloud, stable account mapping |
| SuiteCRM | SAML environment and certificate references | Authentik SAML provider, metadata/certificates, CRM roles |
| Traefik, BentoPDF, UrBackup UI | Forward-auth middleware | Proxy provider/outpost assignment and a callback route per hostname |
| Other apps | Local or protocol-specific authentication | Follow their app guide; OIDC is not automatically enabled |

## Native OIDC

1. Create an Authentik application and OAuth2/OIDC provider. Choose a confidential authorization-code client when the application can keep a client secret; match any PKCE requirements.
2. Bind the intended users or groups to the application. Use a stable application slug and provider identity.
3. Register exact HTTPS redirect URIs. Use the URI supplied by the application/version; do not rely on a broad wildcard.
4. Copy the client ID and issuer/discovery location to the owning application settings. Seal the client secret under the precise name and key referenced by the manifest.
5. Request the necessary identity scopes, commonly `openid`, `profile`, and `email`. Add group claims only when the application is configured to consume and authorize them.
6. Test new-account provisioning, existing-account linking, allowed/denied access, and logout in a fresh browser session. Retain a local administrator during the transition.

The issuer is an identity URL; the discovery URL returns configuration describing that issuer and its endpoints. In Authentik’s per-provider mode their shapes are:

```text title="Issuer and discovery document · replace the host and slug"
Issuer
https://<auth-host>/application/o/<application-slug>/

Discovery
https://<auth-host>/application/o/<application-slug>/.well-known/openid-configuration
```

Both browser and application pods must reach the required endpoints. A successful browser login does not prove that the backend can fetch discovery metadata or exchange a code. See [Authentik’s OAuth2 provider reference](https://docs.goauthentik.io/add-secure-apps/providers/oauth2/).

### Callback map

| Application | Callback to allow on the Authentik provider |
| --- | --- |
| Argo CD through Dex | `https://<argocd-host>/api/dex/callback` |
| GitLab | `https://<gitlab-host>/users/auth/openid_connect/callback` |
| Headscale | `https://<headscale-host>/oidc/callback` |
| Headplane | `https://<headscale-host>/admin/oidc/callback` |
| Open WebUI | `https://<open-webui-host>/oauth/oidc/callback` |
| Nextcloud | The callback supplied by the installed `user_oidc` provider configuration |

Replace each hostname with its shared variable value. Preserve path and trailing-slash behavior expected by the application. If the deployment uses a base-path override, derive the callback from that deployed configuration.

### Stable identity and roles

Prefer an immutable subject identifier for account association. Before enabling automatic linking by email, establish how verified email, renamed users, and existing local accounts are handled. A mistaken identity mapping can attach a new login to the wrong application account.

Explicitly assign application roles after authentication. Headplane’s default `member` role is not an administrator. GitLab group/project membership and SuiteCRM security groups are separate from Authentik portal assignment.

## SuiteCRM SAML

SuiteCRM uses signed SAML assertions in this repository. Exchange metadata rather than guessing endpoints:

1. Read the deployed SuiteCRM service-provider metadata to obtain its entity ID, ACS URL, and supported bindings.
2. Create the Authentik SAML provider, enter those values, and bind the authorized group.
3. Match the IdP entity ID and SSO/SLO URLs with `suitecrm-env`.
4. Seal the IdP certificate and SP certificate/private key into `suitecrm-saml`.
5. Match the configured username attribute and test account provisioning plus CRM permissions.

Changing signing certificates requires coordinating both ends. Keep the private key out of metadata, Git, and documentation; only the public certificate is exchanged with the other party. See [SuiteCRM administration documentation](https://docs.suitecrm.com/admin/).

## Forward-auth

Forward-auth protects an HTTP origin before requests reach an application. Traefik asks Authentik for an access decision, then routes an allowed request to the backend. This does not automatically create a user or administrator session inside that backend.

The existing middleware is `authentik-forward-auth` in namespace `traefik`. Its address points to the embedded outpost in the Authentik server. Configure each protected host as follows:

1. Create a proxy provider for the exact external HTTPS origin, using the appropriate single-application forward-auth mode.
2. Assign the provider to the embedded outpost and apply the intended access policies.
3. Reference the middleware on the protected ingress.
4. Route `/outpost.goauthentik.io/` on that same host to the outpost **without applying forward-auth again**. Give this route priority over the protected catch-all.
5. Test an unauthenticated request, the callback, an allowed session, and a denied account.

`apps/traefik/forward-auth.yaml` currently supplies this route for the Traefik dashboard hostname only. BentoPDF and UrBackup already reference the middleware but need their own host-specific callback route/provider setup. The following pattern belongs with the protected service and uses its own namespace:

```yaml title="Example BentoPDF outpost routing · template for an administrator change"
apiVersion: v1
kind: Service
metadata:
  name: authentik-outpost
  namespace: bentopdf
spec:
  type: ExternalName
  externalName: authentik-server.authentik.svc.cluster.local
  ports:
    - name: http
      port: 80
---
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: authentik-outpost
  namespace: bentopdf
spec:
  entryPoints:
    - websecure
  routes:
    - kind: Rule
      match: Host(`${BENTOPDF_HOST}`) && PathPrefix(`/outpost.goauthentik.io/`)
      priority: 100
      services:
        - kind: Service
          name: authentik-outpost
          port: 80
  tls:
    secretName: bentopdf-tls
```

This example is documentation, not an already deployed resource. The Traefik Kubernetes CRD provider must permit ExternalName services, as required by this routing pattern; retain that provider setting or use an upstream-supported alternative. The route must be processed by `yaml-envsubst`. Consult [Authentik’s Traefik integration guide](https://docs.goauthentik.io/add-secure-apps/providers/proxy/server_traefik/) for the provider and routing requirements.

## Native clients and service integrations

Do not insert interactive redirects into mail, Git SSH, RustDesk, TURN, vault API, or model API traffic. Use the protocol’s supported tokens, client credentials, server keys, or application authentication. For example, Open WebUI should call LiteLLM with a scoped virtual key even when the browser interface uses OIDC.

## Troubleshoot by the failing boundary

| Symptom | Inspect first |
| --- | --- |
| Redirect URI rejected | Exact callback scheme, hostname, path, and provider allowlist |
| Login works but code exchange fails | Backend DNS/TLS, client secret, token auth method, discovery document |
| Outpost path returns 404 | Host-specific route, provider external origin, outpost assignment |
| Repeated redirect loop | Cookie origin, trusted proxy/public URL, callback middleware recursion |
| User logs in but cannot act | Application role, group claims, and local authorization |
| Existing account is duplicated | Subject mapping, provider identity, email linking/provisioning policy |

Keep credentials and authorization codes out of logs shared with others. Record the provider name, callback path, time, and error category instead.
