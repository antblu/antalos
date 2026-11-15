---
title: "Traefik · Use"
description: "Find the Traefik router for a hostname or entrypoint and inspect its backends."
---

<nav class="guide-switcher" aria-label="Traefik guide sections"><a aria-current="page" href="/user-guide/traefik/">Use</a><a href="/infrastructure/traefik/">Architecture</a><a href="/admin-guide/traefik/">Operate</a></nav>

Traefik routes external requests to antalos services. HTTP routers match hostnames and paths, middleware adds behavior such as authentication, and TCP/UDP routes expose native protocols. Its dashboard helps operators see which routes and services are active.

## Access

Open [traefik.antblu.net](https://traefik.antblu.net) or use the address your administrator gave you. Ask your administrator for access if you need an account or role.

## Inspect a route

1. Open the protected dashboard and locate the router matching the affected hostname or entry point.

2. Follow that router to its middleware chain and backend Service. Compare the service port and ready endpoints with the application manifest.

3. For native protocols, inspect their TCP or UDP entry point instead of the HTTP router list.

4. Keep routing changes in Git; a working route also needs DNS, a reachable LoadBalancer address, and a valid backend.

## Get help

Report the hostname, time, and browser response. Mention whether authentication completed before the error appeared. Do not change the URL to an IP address to bypass routing or certificate checks.

## During an interruption

If several routes stop responding, report the affected hostnames and protocols so the administrator can trace the shared ingress path.

See [expected failure behavior and recovery](/infrastructure/traefik/#availability-and-failure-behavior).

## Official documentation

Use the [official Traefik documentation](https://doc.traefik.io/traefik/) for your installed version. Ask your administrator which optional features are enabled.

See the [architecture](/infrastructure/traefik/) or [deployment guide](/admin-guide/traefik/).
