terraform {
  required_version = ">= 1.0"
  required_providers {
    proxmox = {
      source  = "bpg/proxmox"
      version = ">= 0.66.0"
    }
    talos = {
      source  = "siderolabs/talos"
      version = "~> 0.11"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.30"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.15"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}