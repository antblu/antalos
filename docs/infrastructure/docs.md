---
title: "Antalos documentation · Architecture"
description: "Backend components, persistence, placement, and failure boundaries for antalos documentation in antalos."
---

<nav class="guide-switcher" aria-label="antalos documentation guide sections"><a href="/user-guide/docs/">Use</a><a href="/infrastructure/docs/">Architecture</a><a href="/admin-guide/docs/">Operate</a></nav>

Astro Starlight reads Markdown from `docs/` through `site/src/content.config.ts`. The static build is copied into an unprivileged NGINX image and published by GitHub Actions. Two stateless NGINX replicas serve the image on port 8080 behind a Kubernetes Service and Traefik. cert-manager manages `docs-tls`.

## Component boundaries

<figure class="architecture-diagram" aria-label="antalos documentation · component flow">
<div class="diagram-heading">antalos documentation · component flow</div>
<ol class="diagram-flow" role="list">
  <li class="diagram-stage">
    <span class="diagram-label">Build</span>
    <ul>
      <li>docs/ + site/</li>
      <li>Astro → image in GHCR</li>
    </ul>
  </li>
  <li class="diagram-stage">
    <span class="diagram-label">Delivery</span>
    <ul>
      <li>Argo CD → Deployment</li>