---
title: "RustDesk · Use"
description: "Configure the RustDesk client and connect to an authorized remote device."
---

<nav class="guide-switcher" aria-label="RustDesk guide sections"><a aria-current="page" href="/user-guide/rustdesk/">Use</a><a href="/infrastructure/rustdesk/">Architecture</a><a href="/admin-guide/rustdesk/">Operate</a></nav>

RustDesk supplies remote desktop access between enrolled clients. antalos hosts the open-source rendezvous server and two relay processes. The remote desktop remains on the target device; the server helps peers find each other and relays traffic when a direct connection is unavailable.

## Access

Open [rustdesk.antblu.net](https://rustdesk.antblu.net) or use the address your administrator gave you. Ask your administrator for access if you need an account or role.

## Start a remote session

1. Install the RustDesk client on both devices. In the client network settings, enter the administrator-provided ID server and the public identity key.

2. Leave Relay Server and API Server empty for the standard antalos configuration. The ID server advertises the relay endpoints.

3. Enter the remote device ID, request a connection, and have its owner approve access or use an unattended-access credential the owner configured.

4. End the session when finished and review unattended-access settings on shared or retired devices. A server identity key is public configuration; it is not the remote device password.

## Get help

Include the remote-device identifier and whether discovery, connection, authorization, or the active session failed. Never include the unattended-access password. The remote user may need to approve a new session.

## During an interruption

An interrupted desktop connection does not move seamlessly to another server. Reconnect through the normal client workflow and obtain remote approval where required.

See [expected failure behavior and recovery](/infrastructure/rustdesk/#availability-and-failure-behavior).

## Official documentation

Use the [official RustDesk documentation](https://rustdesk.com/docs/en/) for your installed version. Ask your administrator which optional features are enabled.

See the [architecture](/infrastructure/rustdesk/) or [deployment guide](/admin-guide/rustdesk/).
