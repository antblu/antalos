---
title: "Traefik \u00b7 Overview and User Guide"
description: "What Traefik does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="Traefik guide sections"><a aria-current="page" href="/user-guide/traefik/">Overview and User Guide</a><a href="/infrastructure/traefik/">Infrastructure Explanation</a><a href="/admin-guide/traefik/">Deployment and Admin Guide</a></nav>

Traefik routes external requests to Antalos services. HTTP routers match hostnames and paths, middleware adds behavior such as authentication, and TCP/UDP routes expose native protocols. Its dashboard helps operators see which routes and services are active.

## Access and audience

The public address is defined by `TRAEFIK_HOST` in `apps/variables.yaml`. Use your deployment’s value; Antalos hostnames are examples for a fork.

## Your first workflow

1. Open the protected dashboard and locate the router matching the affected hostname or entry point.

2. Follow that router to its middleware chain and backend Service. Compare the service port and ready endpoints with the application manifest.

3. For native protocols, inspect their TCP or UDP entry point instead of the HTTP router list.

4. Keep routing changes in Git; a working route also needs DNS, a reachable LoadBalancer address, and a valid backend.

## When you need an administrator

An HTTP 404 often means no router matched; a 502/503 points toward backend connectivity or readiness. A 404 specifically on the outpost path needs provider and host-route inspection. Examine the layer that generated the response before changing application replicas.

## Availability when using this service

**HA ingress process tier for one serving-node loss; upstream routing and established connections remain separate.** A ready proxy remains on the other worker; endpoint/advertisement detection and surviving throughput set the interruption. The real backend must also survive the same failure.

Read [how redundancy and recovery work](/infrastructure/traefik/#availability-and-failure-behavior), including upgrade interruptions and external dependencies. These are design expectations, not a live status indicator.

## Official documentation

Use the [official Traefik documentation](https://doc.traefik.io/traefik/) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/traefik/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/traefik/).
