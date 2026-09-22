---
title: "RustDesk · Use"
description: "What RustDesk does, how to use it in antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="RustDesk guide sections"><a aria-current="page" href="/user-guide/rustdesk/">Use</a><a href="/infrastructure/rustdesk/">Architecture</a><a href="/admin-guide/rustdesk/">Operate</a></nav>

RustDesk supplies remote desktop access between enrolled clients. antalos hosts the open-source rendezvous server and two relay processes. The remote desktop remains on the target device; the server helps peers find each other and relays traffic when a direct connection is unavailable.

## Access and audience

For this installation, use [rustdesk.antblu.net](https://rustdesk.antblu.net). If you use another antalos installation, open the address supplied by its administrator. Ask for the account or role you need before starting.

## Your first workflow

1. Install the RustDesk client on both devices. In the client network settings, enter the administrator-provided ID server and the public identity key.

2. Leave Relay Server and API Server empty for the standard antalos configuration. The ID server advertises the relay endpoints.

3. Enter the remote device ID, request a connection, and have its owner approve access or use a deliberately configured unattended-access credential.

4. End the session when finished and review unattended-access settings on shared or retired devices. A server identity key is public configuration; it is not the remote device password.

## Get help

Include the remote-device identifier and whether discovery, connection, authorization, or the active session failed. Never include the unattended-access password. The remote user may need to approve a new session.

## During an interruption

An interrupted desktop connection does not move seamlessly to another server. Reconnect through the normal client workflow and obtain remote approval where required.

Administrators can read [the architecture and recovery limits](/infrastructure/rustdesk/#availability-and-failure-behavior).

## Official documentation

Use the [official RustDesk documentation](https://rustdesk.com/docs/en/) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/rustdesk/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/rustdesk/).
