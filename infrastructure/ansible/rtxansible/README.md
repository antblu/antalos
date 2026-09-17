# Debian RTX application node

This Ansible project provisions llama-swap and Speaches on `debian-rtx`
(`10.30.0.26`). The Compose and llama-swap configuration are copied from this
repository to `/opt/compose` on every playbook run. Model files remain under
`/srv/llama-models`; the playbook does not download the local GGUF files.

llama-swap keeps the Qwen embedding model, Qwen reranker, and Gemma 4 E4B
loaded together at startup. A request for any of the four other configured
models unloads that baseline group. Only one of those other models runs at a
time. Each has a 600-second idle TTL. The baseline-restorer container watches
for the last large model to stop and loads the three baseline models again.
A baseline request while a large model is active also swaps the large model
out. The local Gemma, Qwen, and MTP files in `config.yaml` must already exist
under `/srv/llama-models`. The Hugging Face model definitions use llama.cpp's
`--hf-repo` acquisition and cache under that same directory.

The API remains at `http://10.30.0.26:8080/v1` and uses the existing
`vault_llama_cpp_api_key` value as llama-swap's API key. Speaches remains at
`http://10.30.0.26:8000`. Both services reserve the RTX 3060 through the
NVIDIA Container Toolkit. Speaches is separate from llama-swap's model groups
and can still consume GPU memory while a large model loads.

The VM and RTX 3060 PCI passthrough are declared in
`infrastructure/opentofu/rtxtofu`.

## Secret

Create and encrypt the vault before the first run:

```bash
cd infrastructure/ansible/rtxansible
cp vars/vault.yml.example vars/vault.yml
ansible-vault encrypt vars/vault.yml
ansible-vault edit vars/vault.yml
```

Generate the inference API key with `openssl rand -hex 32`. Keep it quoted
in the vault and do not commit the decrypted vault.

## Provision

Apply `rtxtofu`, confirm VM 120 has the `rtx-3060` mapping, and wait for its
cloud-init reboot. Then run:

```bash
cd infrastructure/ansible/rtxansible
ansible-playbook site.yml --ask-vault-pass
```

The project prompts for the Debian user's sudo password at startup. The
playbook installs the NVIDIA Container Toolkit, checks the passed-through GPU,
and starts the Compose project. Its normal package and kernel tasks can reboot
the VM if upgrades require it.
