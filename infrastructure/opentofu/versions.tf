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
    # kubernetes = {
    #   source  = "hashicorp/kubernetes"
    #   version = "~> 2.30"
    # }
    # helm = {
    #   source  = "hashicorp/helm"
    #   version = "~> 3.0"
    # }
    # kubectl = {
    #   source  = "alekc/kubectl"
    #   version = "~> 2.0"
    # }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}