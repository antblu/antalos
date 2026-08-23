# ============================================================
# ArgoCD Installation (Helm) + GitOps Bootstrap
# ============================================================

# Write the generated kubeconfig to disk so the kubernetes/helm
# providers can connect to the Talos cluster.
resource "local_file" "kubeconfig" {
  content         = talos_cluster_kubeconfig.this.kubeconfig_raw
  filename        = "${path.module}/kubeconfig"
  file_permission = "0600"
}

provider "kubernetes" {
  config_path = local_file.kubeconfig.filename
}

provider "helm" {
  kubernetes = {
    config_path = local_file.kubeconfig.filename
  }
}

# --- Install ArgoCD via the official Helm chart ---
resource "helm_release" "argocd" {
  name             = "argocd"
  repository       = "https://argoproj.github.io/argo-helm"
  chart            = "argo-cd"
  namespace        = "argocd"
  create_namespace = true
  version          = "10.4.0" # Should Update to latest stable version when possible
  values = [file("../argocd/argocd-values.yaml")]
}

# --- Bootstrap "App of Apps" Application pointing at the apps repo ---
resource "kubernetes_manifest" "argocd_bootstrap" {
  depends_on = [helm_release.argocd]
  manifest = {
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "Application"
    metadata = {
      name      = "argocd-self"
      namespace = "argocd"
    }
    spec = {
      project = "default"
      source = {
        repoURL        = "https://github.com/antblu/antalos"
        path           = "infrastructure/argocd"
        targetRevision = "HEAD"
      }
      destination = {
        server    = "https://kubernetes.default.svc"
        namespace = "argocd"
      }
      syncPolicy = {
        automated = {
          prune    = true
          selfHeal = true
        }
      }
    }
  }
}