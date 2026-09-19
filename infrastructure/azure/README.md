# Azure edge cloud-init

This cloud-init template configures a Debian 13 ARM64 Azure VM as an edge TCP proxy. It:

- creates the administrative user and installs its SSH public key;
- installs and enables nftables with an inbound allowlist;
- installs Tailscale and joins the private Headscale network;
- installs CrowdSec, its SSH collection, and the nftables firewall bouncer; and
- configures HAProxy to forward HTTPS and mail traffic to both private backends.

## Configuration files

`variables.yaml` contains non-sensitive deployment settings and is committed to Git. `secrets.yaml` contains the Headscale enrollment key and is ignored by Git. `secrets.example.yaml` documents the required secret without containing a usable credential.

The committed `cloud-init.yaml` is a template. Do not give it directly to Azure because `${VARIABLE_NAME}` placeholders must be expanded first.

## Set the secret

From this directory, create the ignored secrets file and replace its example value:

```bash
cp secrets.example.yaml secrets.yaml
chmod 600 secrets.yaml
```

Use a preauthorized Headscale key suitable for this node. Treat the rendered cloud-init as sensitive because it contains that key, even though the script deletes `/run/headscale-auth-key` after enrollment.

## Render the cloud-init

The following commands require Mike Farah `yq` v4 and GNU `envsubst`:

```bash
set -a
eval "$(yq -o=shell '.' variables.yaml)"
eval "$(yq -o=shell '.' secrets.yaml)"
set +a

variable_names="$({ yq -r 'keys | .[]' variables.yaml; yq -r 'keys | .[]' secrets.yaml; } | sort -u)"
substitutions="$(printf '${%s} ' ${variable_names})"
envsubst "${substitutions}" < cloud-init.yaml > cloud-init.rendered.yaml
```

Passing the explicit substitution list is important: the shell embedded in cloud-init also uses variables such as `$ID` and `$VERSION_CODENAME`, which must remain untouched until the VM runs it.

Upload `cloud-init.rendered.yaml` as the Azure VM's custom data. The rendered file is ignored by Git because it contains the expanded Headscale key.

When changing deployment settings, edit `variables.yaml`. When rotating the enrollment key, edit only `secrets.yaml`, render the file again, and provide the new rendered output when provisioning a replacement VM.
