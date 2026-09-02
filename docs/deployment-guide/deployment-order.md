---
title: Deployment order
description: Bootstrap Antalos from Proxmox infrastructure through Argo CD and cluster secrets.
sidebar:
  order: 2
---

## Fresh-cluster bootstrap order
When rebuilding the cluster from scratch, deploy the components in this general order:
1. Install Prerequisites on client
	- `talosctl`
	- `kubectl`
	- `opentofu`
	- `kubeseal`
2. Terraform/OpenTofu to deploy VMs and bootstrap k8s
```bash
cd ../antalos/infrastructure/opentofu/talostofu 
tofu apply
```
3. Initialize [CLI variables](./cli-variables/)
4. Deploy ArgoCD
```bash
cd ../antalos/infrastructure/opentofu/argotofu 
tofu apply
```

5. Inject [Authentik and PostgreSQL secrets](./k8s-secrets-bootstrap/) in the cluster
6. Add Cloudflare API token
```bash
kubectl create secret generic cloudflare-api-token \
--namespace cert-manager \
--from-literal=api-token='<paste-token>'
# Check what secrets are in the cluster
kubectl get secrets -A
```