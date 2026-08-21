provider "proxmox" {
  endpoint  = var.proxmox_endpoint
  api_token = var.proxmox_api_token
  insecure  = var.proxmox_insecure

  # SSH is optional — uncomment and configure if you need
  # snippet uploads, disk imports via source_file.path,
  # or idmap entries on containers.
  #
  # ssh {
  #   agent    = true
  #   username = var.proxmox_ssh_username
  # }
}