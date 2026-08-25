# ============================================================
# Talos Cluster Variables
# ============================================================

variable "cluster_name" {
  type        = string
  description = "Name of the Talos Kubernetes cluster"
  default     = "talos-cluster"
}

variable "cluster_endpoint" {
  type        = string
  description = "Kubernetes API endpoint for the cluster (control plane VIP or first CP node)"
  default     = "https://10.30.0.6:6443"
}

variable "talos_version" {
  type        = string
  description = "Talos version contract used to generate machine configs"
  default     = "v1.13"
}

variable "kubernetes_version" {
  type        = string
  description = "Kubernetes version for the cluster"
  default     = "v1.36.2"
}

variable "talos_install_disk" {
  type        = string
  description = "Disk device Talos installs to on each node"
  default     = "/dev/sda"
}

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

# --- SSH
variable "proxmox_ssh_username" {
  type        = string
  description = "SSH username for Proxmox node access (required when using API token + SSH)"
  default     = "terraform"
}
variable "proxmox_ssh_password" {
  type        = string
  description = "SSH password for Proxmox node access"
  sensitive   = true
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
  default     = "nocloud-amd64.raw"
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
  default     = 3584
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

variable "se350_worker_vm_memory" {
  type        = number
  description = "Memory in MiB for worker VMs (28 GiB = 28672 MiB)"
  default     = 28672
}

variable "se350_worker_vm_cores" {
  type        = number
  description = "Number of vCPUs for worker VMs"
  default     = 8
}

variable "se350_worker_vm_disk_size" {
  type        = number
  description = "Disk size in GB for worker VMs"
  default     = 300
}

variable "rtx_worker_vm_memory" {
  type        = number
  description = "Memory in MiB for worker VMs (28 GiB = 28672 MiB)"
  default     = 1536
}

variable "rtx_worker_vm_cores" {
  type        = number
  description = "Number of vCPUs for worker VMs"
  default     = 1
}

variable "rtx_worker_vm_disk_size" {
  type        = number
  description = "Disk size in GB for worker VMs"
  default     = 20
}

# ============================================================
# Control Plane VM Definitions
# ============================================================

variable "talos_control_vms" {
  type = map(object({
    name          = string
    node          = string
    vmid          = number
    mac_address   = string
    talos_node_ip = string
  }))
  description = "Map of Talos control plane VM configurations"
  default = {
    rtx = {
      name          = "rtx-talos-control"
      node          = "rtx"
      vmid          = 106
      mac_address   = "BC:24:11:37:F3:40"
      talos_node_ip = "10.30.0.6"
    }
    left = {
      name          = "left-talos-control"
      node          = "se350-left"
      vmid          = 107
      mac_address   = "BC:24:11:9E:3D:91"
      talos_node_ip = "10.30.0.7"
    }
    right = {
      name          = "right-talos-control"
      node          = "se350-right"
      vmid          = 108
      mac_address   = "BC:24:11:2A:6E:67"
      talos_node_ip = "10.30.0.8"
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
    talos_node_ip = string
    external_mac = string
    external_ignore_dhcp_route = bool
  }))
  description = "Map of Talos worker VM configurations"
  default = {
    rtx = {
      name          = "rtx-talos-worker"
      node          = "rtx"
      vmid          = 119
      internal_mac  = "BC:24:11:81:F8:B9"
      talos_node_ip = "10.30.0.16"
      external_mac  = "BC:24:11:C4:44:1B"
      external_ignore_dhcp_route = true
    }
    left = {
      name         = "left-talos-worker"
      node         = "se350-left"
      vmid         = 117
      internal_mac = "BC:24:11:5B:88:F9"
      talos_node_ip = "10.30.0.17"
      external_mac = "BC:24:11:40:0B:01"
      external_ignore_dhcp_route = true
    }
    right = {
      name         = "right-talos-worker"
      node         = "se350-right"
      vmid         = 118
      internal_mac = "BC:24:11:81:F8:C9"
      talos_node_ip = "10.30.0.18"
      external_mac = "BC:24:11:C4:44:0B"
      external_ignore_dhcp_route = true
    }
  }
}