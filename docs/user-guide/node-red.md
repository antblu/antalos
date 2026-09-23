---
title: Node-RED · Use
description: Access the protected flow editor and understand restart behavior.
---

<nav class="guide-switcher" aria-label="Node-RED guides"><a aria-current="page" href="/user-guide/node-red/">Use</a><a href="/infrastructure/node-red/">Architecture</a><a href="/admin-guide/node-red/">Operate</a></nav>

Open [node-red.antblu.net](https://node-red.antblu.net) and sign in through Authentik. Access requires an administrator-assigned policy. Use the editor to build and deploy flows; the server stores flow definitions and installed nodes in its persistent `/data` directory.

A worker failure or planned update interrupts the editor and active flows while the single process restarts. In-flight messages and in-memory context can be lost. Design important workflows to retry safely or use an external durable queue.

See [official Node-RED documentation](https://nodered.org/docs/) for editing flows and the [administration guide](/admin-guide/node-red/) for recovery.
