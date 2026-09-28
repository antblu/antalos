---
title: Forgejo · Use
description: Host Git repositories and collaborate on code.
---

<nav class="guide-switcher" aria-label="Forgejo guides"><a aria-current="page" href="/user-guide/forgejo/">Use</a><a href="/infrastructure/forgejo/">Architecture</a><a href="/admin-guide/forgejo/">Operate</a></nav>

Open [git.antblu.net](https://git.antblu.net) to create repositories, review changes, and track issues. Clone using the HTTPS or SSH URL shown by Forgejo. SSH uses port 22 at the same hostname.

Two application pods serve web and Git traffic on separate workers. A single worker failure should leave one serving pod when the shared database, Redis, NFS, Garage, and ingress paths remain healthy. See [Forgejo's user documentation](https://forgejo.org/docs/latest/user/) for product features and the [architecture guide](/infrastructure/forgejo/) for this installation's limits.
