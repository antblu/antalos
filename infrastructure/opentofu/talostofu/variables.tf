# ============================================================
# Talos Cluster Variables
# ============================================================

variable "cluster_name" {
  type        = string
  description = "Name of the Talos Kubernetes cluster"
  default     = "talos-cluster"
}

variable "cluster_api_port" {
  type        = number
  description = "Kubernetes API server port"
  default     = 6443
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
  default     = 2048
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

variable "talos_worker_ephemeral_disk_size" {
  type        = string
  description = "Ephemeral disk size in GB for worker VMs"
  default     = "60GiB"
}

variable "talos_worker_openebs_disk_size" {
  type        = string
  description = "Minimum disk size in GB for OpenEBS local PVs on worker VMs"
  default     = "100GiB"
}

# ============================================================
# Talos Node Names
# ============================================================

variable "talos_node_names" {
  type = object({
    control = map(string)
    worker  = map(string)
  })
  description = "Hostnames for all Talos control plane and worker nodes"

  default = {
    control = {
      left  = "talos-control-left"
      right = "talos-control-right"
      rtx   = "talos-control-rtx"
    }
    worker = {
      left  = "talos-worker-left"
      right = "talos-worker-right"
      rtx   = "talos-worker-rtx"
    }
  }
}

# ============================================================
# Talos Network & Node IPs
# ============================================================

variable "talos_internal_cidr" {
  type        = string
  description = "CIDR for the Talos internal cluster network"
  default     = "10.30.0.0/24"
}

variable "talos_node_ips" {
  type = object({
    control = map(string)
    worker  = map(string)
  })
  description = "IP addresses for all Talos control plane and worker nodes"

  default = {
    control = {
      left  = "10.30.0.7"
      right = "10.30.0.8"
      rtx   = "10.30.0.6"
    }
    worker = {
      left  = "10.30.0.17"
      right = "10.30.0.18"
      rtx   = "10.30.0.16"
    }
  }
}

# ============================================================
# Control Plane VM Definitions
# ============================================================

variable "talos_control_vms" {
  type = map(object({
    node        = string
    vmid        = number
    mac_address = string
  }))
  description = "Map of Talos control plane VM configurations"
  default = {
    rtx = {
      node          = "rtx"
      vmid          = 106
      mac_address   = "BC:24:11:37:F3:40"
    }
    left = {
      node          = "se350-left"
      vmid          = 107
      mac_address   = "BC:24:11:9E:3D:91"
    }
    right = {
      node          = "se350-right"
      vmid          = 108
      mac_address   = "BC:24:11:2A:6E:67"
    }
  }
}

# ============================================================
# Worker VM Definitions
# ============================================================

variable "talos_worker_vms" {
  type = map(object({
    node                       = string
    vmid                       = number
    internal_mac               = string
    external_mac               = string
    external_ignore_dhcp_route = bool
  }))
  description = "Map of Talos worker VM configurations"
  default = {
    rtx = {
      node          = "rtx"
      vmid          = 119
      internal_mac  = "BC:24:11:81:F8:B9"
      external_mac  = "BC:24:11:C4:44:1B"
      external_ignore_dhcp_route = true
    }
    left = {
      node         = "se350-left"
      vmid         = 117
      internal_mac = "BC:24:11:5B:88:F9"
      external_mac = "BC:24:11:40:0B:01"
      external_ignore_dhcp_route = true
    }
    right = {
      node         = "se350-right"
      vmid         = 118
      internal_mac = "BC:24:11:81:F8:C9"
      external_mac = "BC:24:11:C4:44:0B"
      external_ignore_dhcp_route = true
    }
  }
}