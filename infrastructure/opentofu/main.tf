# ============================================================
# Talos Linux Control Plane VMs (3 nodes)
# ============================================================

resource "proxmox_virtual_environment_vm" "talos_control" {
  for_each  = var.talos_control_vms
  name      = each.value.name
  node_name = each.value.node
  vm_id     = each.value.vmid

  description    = "Talos Linux control plane node: ${each.value.name}"
  tags           = ["talos", "control-plane"]
  on_boot        = true
  stop_on_destroy = true

  # --- Boot from Talos ISO (NoCloud) ---
  cdrom {
    file_id = "${var.iso_storage}:iso/${var.iso_file_name}"
  }

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
  for_each  = var.talos_worker_vms
  name      = each.value.name
  node_name = each.value.node
  vm_id     = each.value.vmid

  description    = "Talos Linux worker node: ${each.value.name}"
  tags           = ["talos", "worker"]
  on_boot        = true
  stop_on_destroy = true

  # --- Boot from Talos ISO (NoCloud) ---
  cdrom {
    file_id = "${var.iso_storage}:iso/${var.iso_file_name}"
  }

  # --- BIOS & Machine Type ---
  bios    = "ovmf"
  machine = "q35"

  # --- QEMU Guest Agent ---
  agent {
    enabled = true
  }

  # --- CPU ---
  cpu {
    cores = var.worker_vm_cores
    type  = "host"
  }

  # --- Memory (ballooning disabled) ---
  memory {
    dedicated = var.worker_vm_memory
    floating  = 0
  }

  # --- SCSI Controller ---
  scsi_hardware = "virtio-scsi-pci"

  # --- Disk (SSD emulation, discard enabled) ---
  disk {
    datastore_id = var.vm_storage
    interface    = "scsi0"
    size         = var.worker_vm_disk_size
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