# CLI Variables

- This creates a talosconfig from a terraform.tfstate after the VMs have been deployed and bootstraped.
```bash
CA=$(jq -r '.resources[] | select(.type=="talos_machine_secrets") | .instances[0].attributes.client_configuration.ca_certificate' terraform.tfstate)
CRT=$(jq -r '.resources[] | select(.type=="talos_machine_secrets") |  .instances[0].attributes.client_configuration.client_certificate' terraform.tfstate)
KEY=$(jq -r '.resources[] | select(.type=="talos_machine_secrets") | .instances[0].attributes.client_configuration.client_key' terraform.tfstate)

cat > talosconfig <<EOF
context: talos-cluster
contexts:
	talos-cluster:
		nodes:
			- 10.30.0.6
		endpoints:
			- 10.30.0.6
			- 10.30.0.7
			- 10.30.0.8
		ca: $CA
		crt: $CRT
		key: $KEY
EOF

chmod 600 talosconfig
```
- Set talosctl environment variable
```bash
export TALOSCONFIG=$PWD/talosconfig
# Test 
talosctl -n 10.30.0.6 get members
```
- Set kubectl environment variable
```bash
# In the directory as the kubeconfig file
export KUBECONFIG=./kubeconfig
# Test
kubectl get nodes
```

- Get Grafana password
```bash
kubectl get secret --namespace monitoring grafana -o jsonpath="{.data.admin-password}" | base64 --decode ; echo
```