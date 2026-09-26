---
title: "Homelable · Rack and Switch Map"
description: "Workbook-sourced rack positions and Juniper EX3300 connections."
---

The owner supplied `homelab (version 1) (2) (1).xlsx`. This page records the **12U Rack Layout**, **EX3300 Map** and management addresses in **IP Address Book**. The switch map's colored port cells match its device color legend, including merged cells for paired links. These are supplied physical records, not a live switch configuration audit. Budget, receipts, planned purchases and historical GPU specifications were not imported as current hardware facts.

The curated deployment input is `infrastructure/ansible/arcansible/homelable/physical.yaml`. Homelable's **12U Rack** design shares inventory identities with the network canvases. The rack is a NavePoint 19-inch, 12U, 600mm enclosure, numbered from the bottom upward.

| Rack position | Equipment |
| --- | --- |
| U12 | Beikong H31F / OPNsense, 1U |
| U11 | Juniper EX3300-24T, 1U |
| U10 | Panduit 24-port Cat6 patch coupler, 1U |
| U8–9 | TrueNAS, 2U, four 3.5-inch bays |
| U4–7 | HP Obelisk / `rtx`, 4U |
| U2–3 | Lenovo SE350 E2 enclosure, 2U, holding `se350-left` and `se350-right` side by side |
| U1 | Tripp-Lite 12-outlet PDU, 1U |

Both SE350s share U2–3 as half-width mounts. The left/right names determine their displayed columns. The workbook does not specify rack positions for the APC UPS, OpenWrt AP or PC. XCC endpoints belong to the SE350 chassis rather than separate rack units. Rack faceplates are generic artwork; the labels and dimensions carry the actual equipment identity.

## EX3300 connections

Management address: **10.20.0.2**. The switch has 24 copper ports, `ge-0/0/0` through `ge-0/0/23`, and four SFP+ ports, `xe-0/1/0` through `xe-0/1/3`.

| Switch ports | Endpoint | Mode / VLANs | Link details |
| --- | --- | --- | --- |
| ge-0/0/0–1 | OPNsense | Trunk / ALL | LACP; switch ports are 1Gb/s, router NICs are 2.5Gb/s |
| ge-0/0/2–3 | XCC-Left, 10.20.0.4 | Access / 20 | 1Gb/s failover pair |
| ge-0/0/4–5 | XCC-Right, 10.20.0.3 | Access / 20 | 1Gb/s failover pair |
| ge-0/0/6 | rtx management, 10.20.0.6 | Access / 20 | 1Gb/s |
| ge-0/0/7 | TrueNAS management, 10.20.0.5 | Access / 20 | 1Gb/s |
| ge-0/0/8 | APC UPS NMC, 10.20.0.9 | Access / 20 | 100Mb/s |
| ge-0/0/9 | OpenWrt Archer A7, 10.20.0.10 | Trunk / 20,10 | 1Gb/s |
| ge-0/0/10–11 | se350-left management, 10.20.0.7 | Access / 20 | 1Gb/s failover pair |
| ge-0/0/12–13 | se350-right management, 10.20.0.8 | Access / 20 | 1Gb/s failover pair |
| ge-0/0/23 | PC | Trunk / ALL | 1Gb/s; IP unspecified |
| xe-0/1/0 | TrueNAS data | Access / 30 | 10Gb/s DAC |
| xe-0/1/1 | rtx data | Trunk / 30,40 | 10Gb/s DAC |
| xe-0/1/2 | se350-left data | Trunk / 30,40 | 10Gb/s DAC |
| xe-0/1/3 | se350-right data | Trunk / 30,40 | 10Gb/s DAC |

All 28 switch sockets appear on the rack faceplate. Nineteen have device assignments; the remaining nine have no device assignment in the workbook. The physical/core network canvas shows all endpoint relationships, including UPS, AP and PC. Rack cables show the sixteen assignments to mounted equipment. Peer socket labels describe their role and switch peer; the workbook does not provide peer OS interface names.

The patch coupler has 24 numbered sockets, but its socket-to-switch/device mapping is not supplied. Rack cables therefore represent endpoint relationships, without claiming a direct cable bypasses the patch panel. No patch coupler routing or PDU power cabling is invented.

## Conflicts and scope

The address book lists the NAS SFP+ link as trunk VLANs 30/40; the more specific **EX3300 Map** lists `xe-0/1/0` as access VLAN 30. This model follows the switch map and retains the discrepancy for confirmation. `ALL` is retained literally; it is not expanded into an assumed live allowed-VLAN list. Spreadsheet Up/Down values are historical; Homelable runs its own current checks. This import changes no switch, VLAN, router, VM or storage configuration.

The owner retired ytdlp2strm. Its hostnames are excluded from future service generation; the old Homelable object is retained under **Retired services**, with monitoring disabled and its documentation preserved.
