resource "proxmox_virtual_environment_file" "debian_cloud_image" {
  content_type = "import"
  datastore_id = var.image_datastore_id
  node_name    = var.proxmox_node_name
  overwrite    = false

  source_file {
    path      = var.debian_cloud_image_url
    file_name = var.debian_cloud_image_file_name
    checksum  = var.debian_cloud_image_sha256
  }
}

resource "proxmox_virtual_environment_file" "cloud_init" {
  content_type = "snippets"
  datastore_id = var.cloud_init_datastore_id
  node_name    = var.proxmox_node_name

  source_raw {
    data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
      hostname        = var.vm_name
      locale          = var.debian_locale
      ssh_public_keys = var.ssh_public_keys
      timezone        = var.debian_timezone
      username        = var.debian_username
    })
    file_name = "${var.vm_name}-cloud-init.yaml"
  }
}

resource "proxmox_virtual_environment_vm" "debian" {
  name      = var.vm_name
  node_name = var.proxmox_node_name
  vm_id     = var.vm_id

  description     = "Debian 13.6 CLI VM with RTX 3060 passthrough; managed by OpenTofu"
  tags            = ["debian", "gpu", "rtx-3060"]
  on_boot         = true
  started         = true
  stop_on_destroy = true

  bios       = "ovmf"
  boot_order = ["scsi0"]
  machine    = "q35"

  agent {
    enabled = true
    trim    = true

    wait_for_ip {
      ipv4 = true
    }
  }

  cpu {
    cores = var.vm_cores
    type  = "host"
  }

  memory {
    dedicated = var.vm_memory
    floating  = 0
  }

  scsi_hardware = "virtio-scsi-single"

  disk {
    datastore_id = var.vm_datastore_id
    interface    = "scsi0"
    import_from  = proxmox_virtual_environment_file.debian_cloud_image.id
    size         = var.vm_disk_size
    cache        = "none"
    discard      = "on"
    iothread     = true
    ssd          = true
  }

  efi_disk {
    datastore_id      = var.vm_datastore_id
    file_format       = "raw"
    type              = "4m"
    pre_enrolled_keys = false
  }

  initialization {
    datastore_id      = var.vm_datastore_id
    user_data_file_id = proxmox_virtual_environment_file.cloud_init.id

    dns {
      servers = var.vm_dns_servers
    }

    ip_config {
      ipv4 {
        address = var.vm_ipv4_address
        gateway = var.vm_ipv4_gateway
      }
    }
  }

  network_device {
    bridge      = var.network_bridge
    firewall    = false
    mac_address = var.vm_mac_address
    model       = "virtio"
  }

  operating_system {
    type = "l26"
  }

  vga {
    type = "std"
  }

  dynamic "hostpci" {
    for_each = var.rtx_3060_passthrough_enabled ? [var.rtx_3060_mapping] : []

    content {
      device  = "hostpci0"
      mapping = hostpci.value
      pcie    = true
      rombar  = true
      xvga    = false
    }
  }

  tablet_device = false
}

output "vm_id" {
  description = "Proxmox VM identifier"
  value       = proxmox_virtual_environment_vm.debian.vm_id
}

output "vm_name" {
  description = "Proxmox VM name"
  value       = proxmox_virtual_environment_vm.debian.name
}

output "ipv4_addresses" {
  description = "IPv4 addresses reported by the QEMU guest agent"
  value       = proxmox_virtual_environment_vm.debian.ipv4_addresses
}
