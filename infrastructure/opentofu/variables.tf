# ============================================================
# Proxmox Connection Variables
# ============================================================

variable "proxmox_endpoint" {
  type        = string
  description = "Proxmox VE API endpoint URL (e.g. https://10.0.0.2:8006/)"
}

variable "proxmox_api_token" {
  type        = string
  description = "Proxmox API token in the format user@realm!tokenid=secret"
  sensitive   = true
}

variable "proxmox_insecure" {
  type        = bool
  description = "Skip TLS certificate verification (use true for self-signed certs)"
  default     = true
}

# --- SSH (optional, only if needed) ---
variable "proxmox_ssh_username" {
  type        = string
  description = "SSH username for Proxmox node access (required when using API token + SSH)"
  default     = "terraform"
}

# ============================================================
# ISO Configuration
# ============================================================

variable "iso_storage" {
  type        = string
  description = "Storage pool where the Talos ISO is stored"
  default     = "local"
}

variable "iso_file_name" {
  type        = string
  description = "Talos Linux ISO filename on the Proxmox ISO storage"
  default     = "v1-13-7qemu-agent-nocloud-amd64.iso"
}

# ============================================================
# VM Storage & Networking
# ============================================================

variable "vm_storage" {
  type        = string
  description = "Storage pool for VM disks and EFI disks"
  default     = "local-lvm"
}

variable "internal_bridge" {
  type        = string
  description = "Proxmox bridge name for the internal (cluster) network"
  default     = "internal"
}

variable "external_bridge" {
  type        = string
  description = "Proxmox bridge name for the external network"
  default     = "external"
}

# ============================================================
# Control Plane VM Specs
# ============================================================

variable "control_vm_memory" {
  type        = number
  description = "Memory in MiB for control plane VMs"
  default     = 3072
}

variable "control_vm_cores" {
  type        = number
  description = "Number of vCPUs for control plane VMs"
  default     = 2
}

variable "control_vm_disk_size" {
  type        = number
  description = "Disk size in GB for control plane VMs"
  default     = 32
}

# ============================================================
# Worker VM Specs
# ============================================================

variable "worker_vm_memory" {
  type        = number
  description = "Memory in MiB for worker VMs (28 GiB = 28672 MiB)"
  default     = 28672
}

variable "worker_vm_cores" {
  type        = number
  description = "Number of vCPUs for worker VMs"
  default     = 6
}

variable "worker_vm_disk_size" {
  type        = number
  description = "Disk size in GB for worker VMs"
  default     = 300
}

# ============================================================
# Control Plane VM Definitions
# ============================================================

variable "talos_control_vms" {
  type = map(object({
    name        = string
    node        = string
    vmid        = number
    mac_address = string
  }))
  description = "Map of Talos control plane VM configurations"
  default = {
    rtx = {
      name        = "rtx-talos-control"
      node        = "rtx"
      vmid        = 106
      mac_address = "BC:24:11:37:F3:40"
    }
    left = {
      name        = "left-talos-control"
      node        = "se350-left"
      vmid        = 108
      mac_address = "BC:24:11:9E:3D:91"
    }
    right = {
      name        = "right-talos-control"
      node        = "se350-right"
      vmid        = 107
      mac_address = "BC:24:11:2A:6E:67"
    }
  }
}

# ============================================================
# Worker VM Definitions
# ============================================================

variable "talos_worker_vms" {
  type = map(object({
    name         = string
    node         = string
    vmid         = number
    internal_mac = string
    external_mac = string
  }))
  description = "Map of Talos worker VM configurations"
  default = {
    right = {
      name         = "right-talos-worker"
      node         = "se350-right"
      vmid         = 118
      internal_mac = "BC:24:11:81:F8:C9"
      external_mac = "BC:24:11:C4:44:0B"
    }
    left = {
      name         = "left-talos-worker"
      node         = "se350-left"
      vmid         = 117
      internal_mac = "BC:24:11:5B:88:F9"
      external_mac = "BC:24:11:40:0B:01"
    }
  }
}