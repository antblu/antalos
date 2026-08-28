# ============================================================
# Shared Talos values
# ============================================================
locals {
  cluster_endpoint = format(
    "https://%s:%d",
    var.talos_node_ips.control["rtx"],
    var.cluster_api_port
  )

  talos_control_vms = {
    for key, vm in var.talos_control_vms : key => merge(vm, {
      name          = var.talos_node_names.control[key]
      talos_node_ip = var.talos_node_ips.control[key]
    })
  }

  talos_worker_vms = {
    for key, vm in var.talos_worker_vms : key => merge(vm, {
      name          = var.talos_node_names.worker[key]
      talos_node_ip = var.talos_node_ips.worker[key]
    })
  }
}

# ============================================================
# Talos Machine Secrets (generated once, stored in state)
# ============================================================
resource "talos_machine_secrets" "this" {}

# ============================================================
# Generate machine configurations
# ============================================================
data "talos_machine_configuration" "controlplane" {
  for_each           = local.talos_control_vms
  cluster_name       = var.cluster_name
  cluster_endpoint   = local.cluster_endpoint
  machine_type       = "controlplane"
  machine_secrets    = talos_machine_secrets.this.machine_secrets
  talos_version      = var.talos_version
  kubernetes_version = var.kubernetes_version

  config_patches = [
    yamlencode({
      machine = {
        install = {
          disk  = var.talos_install_disk
          image = "https://factory.talos.dev/image/ce4c980550dd2ab1b17bbf2b08801c7eb59418eafe8f279833297925d67c7515/v1.13.9/nocloud-amd64.raw.xz"
        }
      }
    }),

    yamlencode({
      apiVersion = "v1alpha1"
      kind       = "HostnameConfig"
      hostname   = each.value.name
      auto       = "off"
    })
  ]
}
# Common Talos worker configuration
locals {
  talos_worker_machine_config = {
    machine = {
      install = {
        disk  = var.talos_install_disk
        image = "https://factory.talos.dev/image/ce4c980550dd2ab1b17bbf2b08801c7eb59418eafe8f279833297925d67c7515/v1.13.9/nocloud-amd64.raw.xz"
      }

      network = {
        interfaces = [
          {
            interface = "eth0"
            dhcp      = true

            dhcpOptions = {
              routeMetric = 1024
            }
          },
          {
            interface = "eth1"
            dhcp      = true

            dhcpOptions = {
              routeMetric = 2048
            }
          }
        ]
      }
    }
  }
}
# Generate worker machine configurations
data "talos_machine_configuration" "worker" {
  for_each           = local.talos_worker_vms
  cluster_name       = var.cluster_name
  cluster_endpoint   = local.cluster_endpoint
  machine_type       = "worker"
  machine_secrets    = talos_machine_secrets.this.machine_secrets
  talos_version      = var.talos_version
  kubernetes_version = var.kubernetes_version

  config_patches = concat(
    [
      yamlencode({
        machine = merge(
          local.talos_worker_machine_config.machine,
          {
            kubelet = each.key == "rtx" ? {
              extraArgs = {
                "register-with-taints" = "quorum:NoSchedule"
              }
            } : null

            nodeTaints = each.key == "rtx" ? {
              "quorum" = "NoSchedule"
            } : null
          }
        )
      }),

      yamlencode({
        apiVersion = "v1alpha1"
        kind       = "HostnameConfig"
        hostname   = each.value.name
        auto       = "off"
      })
    ],
    each.key != "rtx" ? [
      yamlencode({
        apiVersion = "v1alpha1"
        kind       = "VolumeConfig"
        name       = "EPHEMERAL"

        provisioning = {
          diskSelector = {
            match = "system_disk"
          }

          maxSize = var.talos_worker_ephemeral_disk_size
          grow    = false
        }
      }),

      yamlencode({
        apiVersion = "v1alpha1"
        kind       = "UserVolumeConfig"
        name       = "openebs-local"

        provisioning = {
          diskSelector = {
            match = "system_disk"
          }

          minSize = var.talos_worker_openebs_disk_size
          grow    = true
        }

        filesystem = {
          type = "xfs"
        }
      })
    ] : []
  )
}

# ============================================================
# Talos Linux Control Plane VMs (3 nodes)
# ============================================================

resource "proxmox_virtual_environment_vm" "talos_control" {
  for_each  = local.talos_control_vms
  name      = each.value.name
  node_name = each.value.node
  vm_id     = each.value.vmid

  description    = "Talos Linux control plane node: ${each.value.name}"
  tags           = ["talos", "control-plane"]
  on_boot        = true
  stop_on_destroy = true

  # --- BIOS & Machine Type ---
  bios    = "ovmf"
  machine = "q35"

  # --- QEMU Guest Agent ---
  agent {
    enabled = true
  }

  # --- CPU ---
  cpu {
    cores = var.control_vm_cores
    type  = "host"
  }

  # --- Memory (ballooning disabled) ---
  memory {
    dedicated = var.control_vm_memory
    floating  = 0
  }

  # --- SCSI Controller ---
  scsi_hardware = "virtio-scsi-pci"

  # --- Disk (SSD emulation, discard enabled) ---
  disk {
    datastore_id = var.vm_storage
    interface    = "scsi0"
    import_from  = "${var.iso_storage}:import/${var.iso_file_name}"
    size         = var.control_vm_disk_size
    ssd          = true
    discard      = "on"
  }

  # --- EFI Disk (OVMF, no pre-enrolled keys, no TPM) ---
  efi_disk {
    datastore_id      = var.vm_storage
    file_format       = "raw"
    type              = "4m"
    pre_enrolled_keys = false
  }

  # --- Network: internal bridge (firewall disabled) ---
  network_device {
    bridge      = var.internal_bridge
    mac_address = each.value.mac_address
    firewall    = false
    model       = "virtio"
  }

  # --- OS Type ---
  operating_system {
    type = "l26"
  }
}

# ============================================================
# Talos Linux Worker VMs (2 nodes)
# ============================================================

resource "proxmox_virtual_environment_vm" "talos_worker" {
  for_each  = local.talos_worker_vms
  name      = each.value.name
  node_name = each.value.node
  vm_id     = each.value.vmid

  description    = "Talos Linux worker node: ${each.value.name}"
  tags           = ["talos", "worker"]
  on_boot        = true
  stop_on_destroy = true

  # --- BIOS & Machine Type ---
  bios    = "ovmf"
  machine = "q35"

  # --- QEMU Guest Agent ---
  agent {
    enabled = true
  }

  # --- CPU ---
  cpu {
    cores = each.key == "rtx" ? var.rtx_worker_vm_cores : var.se350_worker_vm_cores
    type  = "host"
  }

  # --- Memory (ballooning disabled) ---
  memory {
    dedicated = each.key == "rtx" ? var.rtx_worker_vm_memory : var.se350_worker_vm_memory
    floating  = 0
  }

  # --- SCSI Controller ---
  scsi_hardware = "virtio-scsi-pci"

  # --- Disk (SSD emulation, discard enabled) ---
  disk {
    datastore_id = var.vm_storage
    interface    = "scsi0"
    import_from  = "${var.iso_storage}:import/${var.iso_file_name}"
    size         = each.key == "rtx" ? var.rtx_worker_vm_disk_size : var.se350_worker_vm_disk_size
    ssd          = true
    discard      = "on"
  }

  # --- EFI Disk (OVMF, no pre-enrolled keys, no TPM) ---
  efi_disk {
    datastore_id      = var.vm_storage
    file_format       = "raw"
    type              = "4m"
    pre_enrolled_keys = false
  }

  # --- Network: internal bridge (firewall disabled) ---
  network_device {
    bridge      = var.internal_bridge
    mac_address = each.value.internal_mac
    firewall    = false
    model       = "virtio"
  }

  # --- Network: external bridge (firewall disabled) ---
  network_device {
    bridge      = var.external_bridge
    mac_address = each.value.external_mac
    firewall    = false
    model       = "virtio"
  }

  # --- OS Type ---
  operating_system {
    type = "l26"
  }
}

# ============================================================
# Apply Talos machine configs to each node
# ============================================================
resource "talos_machine_configuration_apply" "controlplane" {
  for_each                    = local.talos_control_vms
  client_configuration        = talos_machine_secrets.this.client_configuration
  machine_configuration_input = data.talos_machine_configuration.controlplane[each.key].machine_configuration
  node                        = each.value.talos_node_ip
  depends_on                  = [proxmox_virtual_environment_vm.talos_control]
}

resource "talos_machine_configuration_apply" "worker" {
  for_each                    = local.talos_worker_vms
  client_configuration        = talos_machine_secrets.this.client_configuration
  machine_configuration_input = data.talos_machine_configuration.worker[each.key].machine_configuration
  node                        = each.value.talos_node_ip
  depends_on                  = [proxmox_virtual_environment_vm.talos_worker]
}

# ============================================================
# Bootstrap the cluster (etcd) on the first control plane node
# ============================================================
resource "talos_machine_bootstrap" "this" {
  depends_on = [
    talos_machine_configuration_apply.controlplane,
  ]

  node                 = local.talos_control_vms["rtx"].talos_node_ip
  client_configuration = talos_machine_secrets.this.client_configuration
}
# ============================================================
# Generate kubeconfig
# ============================================================
resource "talos_cluster_kubeconfig" "this" {
  client_configuration = talos_machine_secrets.this.client_configuration
  node                 = local.talos_control_vms["rtx"].talos_node_ip
  depends_on           = [talos_machine_bootstrap.this]
}

# ============================================================
# Write the generated kubeconfig to disk so the argocd stack
# (../argocd) can connect to the cluster.
# ============================================================
resource "local_file" "kubeconfig" {
  content         = talos_cluster_kubeconfig.this.kubeconfig_raw
  filename        = "${path.module}/kubeconfig"
  file_permission = "0600"
}

output "kubeconfig" {
  value     = talos_cluster_kubeconfig.this.kubeconfig_raw
  sensitive = true
}