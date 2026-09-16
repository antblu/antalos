locals {
  haproxy_vms = {
    for key, vm in var.haproxy_vms : key => merge(vm, {
      ipv4_address = "${vm.ipv4_address}/${var.network_prefix_length}"
    })
  }
}

resource "proxmox_virtual_environment_file" "alpine_cloud_image" {
  for_each = local.haproxy_vms

  content_type = "import"
  datastore_id = var.image_datastore_id
  node_name    = each.value.node
  overwrite    = false

  source_file {
    path      = var.alpine_cloud_image_url
    file_name = var.alpine_cloud_image_file_name
  }
}

resource "proxmox_virtual_environment_file" "cloud_init" {
  for_each = local.haproxy_vms

  content_type = "snippets"
  datastore_id = var.cloud_init_datastore_id
  node_name    = each.value.node

  source_raw {
    data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
      hostname        = each.value.name
      ssh_public_keys = var.ssh_public_keys
      timezone        = var.timezone
      traefik_ip      = var.traefik_ip
      tcp_ports       = var.traefik_tcp_ports
    })
    file_name = "${each.value.name}-cloud-init.yaml"
  }
}

resource "proxmox_virtual_environment_vm" "haproxy" {
  for_each = local.haproxy_vms

  name      = each.value.name
  node_name = each.value.node
  vm_id     = each.value.vmid

  description     = "Lean Alpine HAProxy edge forwarding to Traefik; managed by OpenTofu"
  tags            = ["alpine", "haproxy", "edge"]
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
      disabled = true
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
    import_from  = proxmox_virtual_environment_file.alpine_cloud_image[each.key].id
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
    user_data_file_id = proxmox_virtual_environment_file.cloud_init[each.key].id

    dns {
      servers = var.vm_dns_servers
    }

    ip_config {
      ipv4 {
        address = each.value.ipv4_address
        gateway = var.vm_ipv4_gateway
      }
    }
  }

  network_device {
    bridge      = var.network_bridge
    firewall    = false
    mac_address = each.value.mac_address
    model       = "virtio"
  }

  operating_system {
    type = "l26"
  }

  vga {
    type = "serial0"
  }

  serial_device {}
  tablet_device = false
}

output "haproxy_vms" {
  description = "HAProxy VM names, IDs, and external IPv4 addresses"
  value = {
    for key, vm in proxmox_virtual_environment_vm.haproxy : key => {
      name         = vm.name
      vm_id        = vm.vm_id
      ipv4_address = local.haproxy_vms[key].ipv4_address
    }
  }
}
