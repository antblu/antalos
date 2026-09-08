---
title: "Configure cluster CLI access"
description: "Use explicit Kubernetes credentials and generate Talos client configuration without tab-indented YAML."
---

Run the examples from the repository root. Kubernetes and Talos use separate client configurations; access to one does not automatically grant access to the other.

## Kubernetes

The Talos OpenTofu stack writes `kubeconfig` at the repository root. Use it explicitly:

```bash title="Read Kubernetes node state"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig get nodes -o wide
```

For a sequence of commands in the same Bash session, a function preserves argument boundaries:

```bash title="Optional session helper"
k() {
  /home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig "$@"
}

k get namespaces
```

Avoid storing an executable plus arguments in one quoted string and relying on word splitting. These guides retain the full command where a snippet should work on its own.

## Talos client configuration

Prefer a recovered `talosconfig` from your protected administration backup. When only local OpenTofu state is available, extract its client configuration into a restricted file. This example uses the existing `talos_machine_secrets` resource and the repository’s three control-plane addresses; adjust the addresses for your fork.

```bash title="Generate talosconfig from local state"
python3 - <<'PYTHON'
import json
import os
from pathlib import Path

os.umask(0o077)
state = json.loads(Path(
    "infrastructure/opentofu/talostofu/terraform.tfstate"
).read_text())
resource = next(
    item for item in state["resources"]
    if item["type"] == "talos_machine_secrets"
)
client = resource["instances"][0]["attributes"]["client_configuration"]
if isinstance(client, list):
    client = client[0]

content = "\n".join([
    "context: antalos",
    "contexts:",
    "  antalos:",
    "    endpoints:",
    "      - 10.30.0.6",
    "      - 10.30.0.7",
    "      - 10.30.0.8",
    "    nodes:",
    "      - 10.30.0.6",
    "    ca: " + client["ca_certificate"],
    "    crt: " + client["client_certificate"],
    "    key: " + client["client_key"],
    "",
])
output = Path("talosconfig")
output.touch(mode=0o600, exist_ok=True)
output.chmod(0o600)
output.write_text(content)
PYTHON
```

This reads sensitive local state without printing it and writes block-style YAML using spaces. If your state uses a remote backend or a different resource structure, use the provider’s supported output/export procedure and protect the resulting file to the same standard.

## Use Talos explicitly

```bash title="Inspect Talos members"
talosctl --talosconfig talosconfig --nodes 10.30.0.6 get members
```

Replace the node address with an endpoint from your actual topology. Prefer explicit flags in runbooks so a stale environment variable cannot silently select another cluster.

## Recover access separately from application passwords

Kubeconfig and talosconfig are administrative credentials. Application passwords are stored in their own named Secrets and should be retrieved privately only when needed. None of the inspection commands above requires printing a Secret value.
