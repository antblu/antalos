---
title: "RustDesk \u00b7 Overview and User Guide"
description: "What RustDesk does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="RustDesk guide sections"><a aria-current="page" href="/user-guide/rustdesk/">Overview and User Guide</a><a href="/infrastructure/rustdesk/">Infrastructure Explanation</a><a href="/admin-guide/rustdesk/">Deployment and Admin Guide</a></nav>

RustDesk supplies remote desktop access between enrolled clients. Antalos hosts the open-source rendezvous server and two relay processes. The remote desktop remains on the target device; the server helps peers find each other and relays traffic when a direct connection is unavailable.

## Access and audience

The public address is defined by `RUSTDESK_HOST` in `apps/variables.yaml`. Use your deployment’s value; Antalos hostnames are examples for a fork.

## Your first workflow

1. Install the RustDesk client on both devices. In the client network settings, enter the administrator-provided ID server and the public identity key.

2. Leave Relay Server and API Server empty for the standard Antalos configuration. The ID server advertises the relay endpoints.

3. Enter the remote device ID, request a connection, and have its owner approve access or use a deliberately configured unattended-access credential.

4. End the session when finished and review unattended-access settings on shared or retired devices. A server identity key is public configuration; it is not the remote device password.

## When you need an administrator

If IDs resolve but connections fail, inspect the advertised relay endpoint and port routing. If restore loops, inspect NFS access and locks. Fence a partitioned old worker before forced recovery; deleting the lock file does not safely establish single-writer ownership.

## Availability when using this service

**Not continuously HA end to end: one recoverable rendezvous server, with two independent native relays.** If hbbs is on the failed node, new rendezvous waits for restart/restore. The surviving relay can serve new native relay sessions once clients can coordinate; sessions on the failed relay reconnect. Some established direct peer connections may remain, but they do not prove new-session availability.

Read [how redundancy and recovery work](/infrastructure/rustdesk/#availability-and-failure-behavior), including upgrade interruptions and external dependencies. These are design expectations, not a live status indicator.

## Official documentation

Use the [official RustDesk documentation](https://rustdesk.com/docs/en/) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/rustdesk/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/rustdesk/).
