# Deployment Order

### Fresh-cluster bootstrap order
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
3. Deploy ArgoCD
```bash
cd ../antalos/infrastructure/opentofu/argotofu 
tofu apply
```
3. Initialize [[cli-variables]]
4. Inject [[k8s-secrets-bootstrap|Authentik and PostgreSQL secrets]] in the cluster
5. Add Cloudflare API token
	```bash
	kubectl create secret generic cloudflare-api-token \
  --namespace cert-manager \
  --from-literal=api-token='<paste-token>'
# Check what secrets are in the cluster
kubectl get secrets -A
	```