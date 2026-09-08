---
title: "Create and recover sealed credentials"
description: "Create precise Secret contracts, encrypt them for Git, and protect the keys required for recovery."
---

Sealed Secrets bridges Git and Kubernetes credentials. A public certificate encrypts the Secret; only the matching controller private key can decrypt it. Keep the original namespace, name, key names, and value formats aligned with the consuming application.

## Choose the correct identity first

For an existing installation, restore its controller keys before reconciling encrypted resources. For a new installation, establish the controller, securely back up its identity, and seal fresh application credentials. Copying another installation’s SealedSecret YAML does not create usable credentials for a new key.

The current controller is `sealed-secrets-controller` in namespace `sealed-secrets`.

```bash title="Fetch the public encryption certificate"
kubeseal --kubeconfig kubeconfig \
  --controller-name sealed-secrets-controller \
  --controller-namespace sealed-secrets \
  --fetch-cert > /tmp/antalos-sealing-cert.pem
```

The certificate is public material. Verify that you are using the intended cluster before sealing credentials for it.

## Create plaintext outside Git

This example produces the database owner Secret consumed by Authentik. Adapt the **name, namespace, type, and keys together** for a different consumer.

```bash title="Create a private credential workspace"
install -d -m 700 "$HOME/.kubernetes-secrets"
umask 077
```

Create `$HOME/.kubernetes-secrets/authentik-db-app.yaml` privately:

```yaml title="Private Secret · never commit this input"
apiVersion: v1
kind: Secret
metadata:
  name: authentik-db-app
  namespace: authentik
type: kubernetes.io/basic-auth
stringData:
  username: authentik
  password: REPLACE_WITH_A_UNIQUE_GENERATED_PASSWORD
```

Use a password manager or cryptographically secure generator for the password, then insert it through a private editing workflow. `stringData` accepts plaintext; `data` expects base64-encoded values. Confusing the two can produce a generated Secret that the application cannot use.

## Seal to the service directory

```bash title="Encrypt the Authentik database credential"
kubeseal \
  --cert /tmp/antalos-sealing-cert.pem \
  --scope strict \
  --format yaml \
  < "$HOME/.kubernetes-secrets/authentik-db-app.yaml" \
  > apps/authentik/db-secret.yaml
```

The output is a SealedSecret. Under strict scope, changing its name or namespace later requires resealing. Do not rename ciphertext as a shortcut to deploying a second application.

Before replacing an existing file, preserve any annotations or additional SealedSecret documents that belong to it. If the service uses sync waves, place the wave annotation on the **top-level SealedSecret metadata**, so Argo CD orders the encrypted resource itself. An annotation only under `spec.template.metadata` is attached to the generated Secret and does not order the SealedSecret.

## Match the consumer contract

| Credential type | What must agree |
| --- | --- |
| Database | Database role, password, connection URI encoding, and Secret key references |
| OIDC | Provider client ID, client secret, issuer/discovery URL, and callback URI |
| Redis Sentinel | Data authentication, replica authentication, Sentinel authentication, and client discovery settings |
| Application encryption | The original encryption/salt/session key and the data it protects |
| Structured configuration | The expected file format inside the Secret value, such as GitLab’s OIDC provider document |

Changing a bootstrap database password Secret does not always rotate the password in an already initialized database. Follow the database’s documented rotation procedure, then update consumers together.

Inspect names and reconciliation status without dumping values:

```bash title="Inspect credential reconciliation"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n authentik get sealedsecrets

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n authentik get secret authentik-db-app
```

## Restore controller keys

The [bootstrap guide](/admin-guide/bootstrap/) explains the OpenTofu key restore and its expected kubeconfig path. When restoring into an already existing namespace/controller installation:

```bash title="Restore all backed-up sealing keys"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  apply -f sealed-secrets-priv-key.yaml

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n sealed-secrets rollout restart deployment/sealed-secrets-controller
```

A backup containing only a newer key cannot decrypt ciphertext made with a lost older key. Retain all keys still required by the repository.

## Back up keys outside the cluster

```bash title="Write a restricted local key backup"
umask 077
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n sealed-secrets get secret \
  -l sealedsecrets.bitnami.com/sealed-secrets-key \
  -o yaml > "$HOME/.kubernetes-secrets/sealed-secrets-keys.yaml"
```

Encrypt and copy that file to the external recovery location. The local file alone is not an off-cluster backup strategy. Refresh the backup after key rotation and prove it can decrypt representative ciphertext:

```bash title="Exercise offline recovery without displaying the credential"
kubeseal --recovery-unseal \
  --recovery-private-key "$HOME/.kubernetes-secrets/sealed-secrets-keys.yaml" \
  < apps/authentik/db-secret.yaml \
  > /dev/null
```

See the [official key backup and recovery documentation](https://github.com/bitnami/sealed-secrets#how-can-i-do-a-backup-of-my-sealedsecrets) for the controller version in use.
