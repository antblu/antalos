---
title: Uptime Kuma · Use
description: Read service status and understand what a monitor can and cannot tell you.
---

<nav class="guide-switcher" aria-label="Uptime Kuma guides"><a aria-current="page" href="/user-guide/uptime-kuma/">Use</a><a href="/infrastructure/uptime-kuma/">Architecture</a><a href="/admin-guide/uptime-kuma/">Operate</a></nav>

Uptime Kuma checks the endpoints configured by an administrator. It can publish status pages so users can see the availability of selected services.

## Find the status page

Open [status.antblu.net](https://status.antblu.net) for the published public status page. The administrator configures which monitors appear there. Administrators use [uptime.antblu.net](https://uptime.antblu.net), which requires Authentik access and the Uptime Kuma administrator account.

## Read a result

Look for the affected service, the time of its last observation, and any incident or maintenance note. A successful check means that the configured probe succeeded from the monitor's location. It may not test your own network, account, file operation, or mail delivery.

If the page is unavailable, report that separately from the service you were using. The monitoring application runs inside antalos and can be affected by the same outage.

## Request a useful monitor

Tell the administrator which service matters, what success looks like, and who should receive alerts. A web page, TCP port, and authenticated workflow test answer different questions. Do not send account passwords as part of a monitoring request.

## Official documentation

See the [official Uptime Kuma wiki](https://github.com/louislam/uptime-kuma/wiki) for monitor, notification, and status-page guidance. The [admin guide](/admin-guide/uptime-kuma/) explains how this installation stores and recovers its configuration.
