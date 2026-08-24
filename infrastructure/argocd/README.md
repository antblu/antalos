# ArgoCD

This directory defines and configures ArgoCD itself (GitOps config only).
The Terraform that installs ArgoCD lives in `../argotofu/` (Option A — shared state).

## Layout
- `argocd-values.yaml` — Helm values for the `argo-cd` chart
- `projects/` — ArgoCD AppProject definitions (RBAC boundaries)
- `applications/` — Root "App of Apps" + optional self-managed Application
- `repositories/` — Git repo credentials (only if the repo is private)

## Access the UI
kubectl port-forward -n argocd svc/argocd-server 8080:443
# then open https://localhost:8080

## Initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d