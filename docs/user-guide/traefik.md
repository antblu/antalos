---
title: "Traefik · Use"
description: "What Traefik does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Traefik guide sections"><a aria-current="page" href="/user-guide/traefik/">Use</a><a href="/infrastructure/traefik/">Architecture</a><a href="/admin-guide/traefik/">Operate</a></nav>

Traefik routes external requests to Antalos services. HTTP routers match hostnames and paths, middleware adds behavior such as authentication, and TCP/UDP routes expose native protocols. Its dashboard helps operators see which routes and services are active.

## Access and audience

For this installation, use [traefik.antblu.net](https://traefik.antblu.net). If you use another Antalos installation, open the address supplied by its administrator. Ask for the account or role you need before starting.

## Your first workflow

1. Open the protected dashboard and locate the router matching the affected hostname or entry point.

2. Follow that router to its middleware chain and backend Service. Compare the service port and ready endpoints with the application manifest.

3. For native protocols, inspect their TCP or UDP entry point instead of the HTTP router list.

4. Keep routing changes in Git; a working route also needs DNS, a reachable LoadBalancer address, and a valid backend.

## Get help

Report the hostname, time, and browser response. Mention whether authentication completed before the error appeared. Do not change the URL to an IP address to bypass routing or certificate checks.

## During an interruption

An interruption can affect the applications that depend on this platform service. Ask the administrator to identify the affected service and expected recovery path.

Administrators can read [the architecture and recovery limits](/infrastructure/traefik/#availability-and-failure-behavior).

## Official documentation

Use the [official Traefik documentation](https://doc.traefik.io/traefik/) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/traefik/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/traefik/).
