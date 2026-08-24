provider "proxmox" {
  endpoint  = var.proxmox_endpoint
  api_token = var.proxmox_api_token
  insecure  = var.proxmox_insecure

  ssh {
    username = var.proxmox_ssh_username
    password = var.proxmox_ssh_password
  }
}