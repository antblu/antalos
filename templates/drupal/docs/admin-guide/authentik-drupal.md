# Authentik handbook excerpts for Drupal

| Application | Standard access | Administrator mapping |
| --- | --- | --- |
| Drupal | Verified OIDC identity in `drupal-users` or the global users umbrella; ordinary authenticated account | Effective `drupal-admins` or `antalos-admins` grants `administrator`; removed on next login when absent; UID 1 stays local |

## Drupal provider blueprint

`drupal-oidc.yaml` declares the blog application/provider, strict
`https://<DRUPAL_HOST>/openid-connect/generic` callback, effective profile claims,
and group bindings. `drupal-oidc-secret.yaml` supplies the confidential client
secret through the chart's global environment. A separate sealed copy in the
Drupal namespace supplies the relying client. Publish and reconcile both
sides together; see the [Drupal runbook](drupal.md#authentik-oidc)
for the derived image, bootstrap sequence, access rules and acceptance steps.
