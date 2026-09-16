variable "proxmox_endpoint" {
  type        = string
  description = "Proxmox VE API endpoint URL"
}

variable "proxmox_api_token" {
  type        = string
  description = "Proxmox API token in user@realm!token=secret format"
  sensitive   = true
}

variable "proxmox_insecure" {
  type        = bool
  description = "Skip Proxmox API TLS certificate verification"
  default     = true
}

variable "proxmox_ssh_username" {
  type        = string
  description = "SSH user used by the Proxmox provider"
  default     = "terraform"
}

variable "proxmox_ssh_password" {
  type        = string
  description = "SSH password used by the Proxmox provider"
  sensitive   = true
}

variable "haproxy_vms" {
  type = map(object({
    name         = string
    node         = string
    vmid         = number
    ipv4_address = string
    mac_address  = string
  }))
  description = "Two HAProxy VMs using the former left and right Talos worker external identities"
  default = {
    left = {
      name         = "haproxy-left"
      node         = "se350-left"
      vmid         = 122
      ipv4_address = "10.40.0.17"
      mac_address  = "BC:24:11:40:0B:01"
    }
    right = {
      name         = "haproxy-right"
      node         = "se350-right"
      vmid         = 123
      ipv4_address = "10.40.0.18"
      mac_address  = "BC:24:11:C4:44:0B"
    }
  }
}

variable "vm_cores" {
  type        = number
  description = "Number of vCPUs for each HAProxy VM"
  default     = 1
}

variable "vm_memory" {
  type        = number
  description = "Dedicated memory in MiB for each HAProxy VM"
  default     = 512
}

variable "vm_disk_size" {
  type        = number
  description = "System disk size in GiB for each HAProxy VM"
  default     = 4
}

variable "vm_datastore_id" {
  type        = string
  description = "Proxmox datastore for VM and EFI disks"
  default     = "local-lvm"
}

variable "image_datastore_id" {
  type        = string
  description = "Proxmox datastore with import content enabled"
  default     = "local"
}

variable "cloud_init_datastore_id" {
  type        = string
  description = "Proxmox datastore with snippets enabled"
  default     = "local"
}

variable "network_bridge" {
  type        = string
  description = "Proxmox bridge for the external 10.40.0.0/24 network"
  default     = "external"
}

variable "network_prefix_length" {
  type        = number
  description = "IPv4 prefix length for the external network"
  default     = 24
}

variable "vm_ipv4_gateway" {
  type        = string
  description = "Default IPv4 gateway on the external network"
  default     = "10.40.0.1"
}

variable "vm_dns_servers" {
  type        = list(string)
  description = "DNS resolvers for the HAProxy VMs"
  default = [
    "10.40.0.1",
  ]
}

variable "traefik_ip" {
  type        = string
  description = "Internal MetalLB address used by the Traefik service"
  default     = "10.30.0.200"
}

variable "traefik_tcp_ports" {
  type        = list(number)
  description = "Traefik TCP entrypoint ports forwarded by HAProxy"
  default = [
    443,
    636,
    21115,
    21116,
    21117,
    21118,
    21119,
    21120,
  ]
}

variable "timezone" {
  type        = string
  description = "Timezone configured by cloud-init"
  default     = "America/Denver"
}

variable "ssh_public_keys" {
  type        = list(string)
  description = "SSH public keys authorized for the alpine user"
}

variable "alpine_cloud_image_url" {
  type        = string
  description = "Pinned official Alpine GenericCloud UEFI cloud-init image"
  default     = "https://dl-cdn.alpinelinux.org/alpine/v3.24/releases/cloud/generic_alpine-3.24.1-x86_64-uefi-cloudinit-r0.qcow2"
}

variable "alpine_cloud_image_file_name" {
  type        = string
  description = "File name used for the Alpine cloud image in Proxmox"
  default     = "generic_alpine-3.24.1-x86_64-uefi-cloudinit-r0.qcow2"
}
