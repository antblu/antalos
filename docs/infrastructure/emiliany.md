---
title: "Emiliany · Architecture"
description: "The Next.js storefront serving tier and its external dependencies."
---

`apps/emiliany/` declares the public `https://emiliany.com` storefront. Traefik terminates TLS using the service-owned cert-manager certificate and forwards to a ClusterIP Service on port 80, then the standalone Next.js server on port 3000. There is no Authentik forward-auth on the customer storefront.

Application code and image build live in `antblu/emiliany`. Antalos owns shared deployment/build inputs and the Argo CD Application. The image excludes local environment files, runs as UID 1000 with a read-only root filesystem, and uses disposable cache and temporary volumes.

## Availability and failure behavior

Two replicas require separate worker hostnames. A `minAvailable: 1` PodDisruptionBudget limits voluntary disruption; rolling updates use zero surge and one unavailable pod. This is a replicated serving tier, not a proof of end-to-end node-loss tolerance. Eligible worker capacity, ingress, Cloudflare, edge routing, DNS, and real-commerce Medusa dependencies must also remain available. In-flight requests can need retries after pod loss.

The initial deployment serves the existing demo catalog. Real commerce and Google customer login remain disabled. No storefront database or persistent volume is introduced. Replicas share the same image build and build-generated Server Function key; cache state is local and disposable. Medusa region responses can remain cached per replica for five minutes.

Use [Emiliany operations](/admin-guide/emiliany/) for release, certificate, and public-browser verification. This page describes source design, not collected workload health.
