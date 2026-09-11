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

variable "proxmox_node_name" {
  type        = string
  description = "Proxmox node that hosts the VM"
  default     = "se350-left"
}

variable "vm_id" {
  type        = number
  description = "Proxmox VM identifier"
  default     = 122
}

variable "vm_name" {
  type        = string
  description = "VM name and Debian hostname"
  default     = "debian-left"
}

variable "vm_cores" {
  type        = number
  description = "Number of VM CPU cores"
  default     = 4
}

variable "vm_memory" {
  type        = number
  description = "Dedicated VM memory in MiB"
  default     = 9216
}

variable "vm_ballooning_minimum" {
  type        = number
  description = "Minimum VM memory in MiB when ballooning"
  default     = 6144
}

variable "vm_disk_size" {
  type        = number
  description = "VM system disk size in GiB"
  default     = 128
}

variable "vm_datastore_id" {
  type        = string
  description = "Proxmox datastore for the VM and EFI disks"
  default     = "local-lvm"
}

variable "image_datastore_id" {
  type        = string
  description = "Proxmox datastore with import content enabled for the Debian image"
  default     = "local"
}

variable "cloud_init_datastore_id" {
  type        = string
  description = "Proxmox datastore with snippets enabled for cloud-init user data"
  default     = "local"
}

variable "network_bridge" {
  type        = string
  description = "Proxmox bridge used by the VM"
  default     = "internal"
}

variable "vm_mac_address" {
  type        = string
  description = "Persistent MAC address for the VM network adapter"
  default     = "bc:24:11:64:0b:40"
}

variable "vm_ipv4_address" {
  type        = string
  description = "Static IPv4 address and prefix for the VM"
  default     = "10.30.0.27/24"
}

variable "vm_ipv4_gateway" {
  type        = string
  description = "Default IPv4 gateway for the VM"
  default     = "10.30.0.1"
}

variable "vm_dns_servers" {
  type        = list(string)
  description = "DNS resolvers for the VM"
  default = [
    "10.30.0.1",
    "10.40.0.1",
  ]
}

variable "debian_timezone" {
  type        = string
  description = "Timezone configured by cloud-init"
  default     = "America/Denver"
}

variable "debian_locale" {
  type        = string
  description = "Locale configured by cloud-init"
  default     = "en_US.UTF-8"
}

variable "debian_cloud_image_url" {
  type        = string
  description = "Immutable official Debian 13.6 GenericCloud image URL"
  default     = "https://cloud.debian.org/images/cloud/trixie/20260712-2537/debian-13-genericcloud-amd64-20260712-2537.qcow2"
}

variable "debian_cloud_image_file_name" {
  type        = string
  description = "File name used for the Debian cloud image in Proxmox"
  default     = "debian-13.6-genericcloud-amd64-20260712-2537.qcow2"
}

variable "debian_cloud_image_sha256" {
  type        = string
  description = "SHA-256 checksum used to verify the pinned Debian cloud image before upload"
  default     = "2cab162ddebb1ef083cca8f8261f77c93ae70f98252aabfeb1d8a28c30b191b1"
}

variable "debian_username" {
  type        = string
  description = "Administrative account created by cloud-init"
  default     = "debian"
}

variable "ssh_public_keys" {
  type        = list(string)
  description = "SSH public keys authorized for the Debian administrative account"

  validation {
    condition     = length(var.ssh_public_keys) > 0
    error_message = "Provide at least one SSH public key for the Debian administrative account."
  }
}
