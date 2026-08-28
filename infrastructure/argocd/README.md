# ArgoCD

OpenTofu installs Argo CD and creates `argocd-self` to bootstrap a fresh cluster.
After bootstrap, `argocd-self` renders the same pinned Helm chart with
`infrastructure/opentofu/argotofu/argocd-values.yaml` and reconciles Argo CD,
the default project, and the app-of-apps Application from Git.

The bootstrap Helm release ignores changes after creation so OpenTofu does not
compete with Argo CD for steady-state ownership. OpenTofu continues to own the
root `argocd-self` Application as a recovery anchor.

Keep the chart version in `argocd-self.yaml` aligned with the bootstrap version
in `infrastructure/opentofu/argotofu/argocd.tf`.
6b7dccd76571bf5b9e728eb1ed3f7433c07a938ff6ee17a8e52cee3d1ed2cb45
