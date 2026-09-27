---
title: CrowdSec · Operate
description: Configure the log processor, LAPI, AppSec, and Traefik credentials without confusing the cluster and edge instances.
---

<nav class="guide-switcher" aria-label="CrowdSec guides"><a href="/user-guide/crowdsec/">Use</a><a href="/infrastructure/crowdsec/">Architecture</a><a aria-current="page" href="/admin-guide/crowdsec/">Operate</a></nav>

Start with the [official CrowdSec documentation](https://docs.crowdsec.net/docs/intro/) and [antalos component layout](/infrastructure/crowdsec/). Configure the Kubernetes system independently from Azure's host firewall integration.

## Prepare dependencies

| Input | Purpose |
| --- | --- |
| `CROWDSEC_CHART_VERSION` and related variables | Chart, backup storage, log URL, and integration version inputs |
| `crowdsec-bootstrap` SealedSecret | LAPI bootstrap, registration, and bouncer credentials |
| NFS backup export | Litestream recovery of the LAPI SQLite database |
| VictoriaLogs | Log query endpoint used by the processor |
| Traefik integration | The consumer of the intended LAPI and AppSec services |

Retain matching registration and bouncer credentials across the producer and consumer. A successful Secret decryption does not establish that Traefik and LAPI use the same value.

## Deploy the cluster components

1. Prepare VictoriaLogs ingestion of Traefik logs and the writable NFS backup path.
2. Set application variables and seal the required bootstrap credentials.
3. Reconcile `apps/crowdsec/app.yaml`, which combines the chart and support manifests.
4. Confirm the Local API initializes, the processor reads the intended query, and AppSec is reachable by its configured consumer.
5. Complete the Traefik integration using the intended cluster endpoints and credential.
6. Use an authorized test request to observe the configured enforcement behavior, then record what the system should do if a dependency is unavailable.

## Investigate a blocked request

Identify the responding layer using the requested host, time, response, and proxy/application logs. Distinguish an identity denial from a CrowdSec decision or an AppSec rejection. Read decision and request details before changing rules or credentials.

For a suspected ingestion problem, inspect the VictoriaLogs query and recent matching events. For authentication errors, inspect registration and bouncer agreement without printing credentials. For startup failures, inspect SQLite restore and NFS access separately from log acquisition.

The Traefik bouncer trusts the single Headscale client address declared by `CROWDSEC_TRUSTED_HEADSCALE_CLIENT_IP` in `apps/variables.yaml`. Its `clientTrustedIPs` exemption bypasses IP remediation and AppSec only when the bouncer identifies that exact client address. Do not whitelist a shared proxy or Kubernetes masquerade address to compensate for missing client identity: that would exempt other clients too. The checked-in HTTPS HAProxy path uses TCP forwarding without PROXY protocol, so it does not preserve the original client address through the proxies.

In stream mode, the bouncer's default `updateMaxFailure: 0` blocks requests when its LAPI decision feed fails. A LAPI outage can therefore produce widespread ingress HTTP 403 responses with `OriginStatus: 0`, even without an IP ban. Correlate those responses with `handleStreamTicker` connection failures, LAPI readiness, and pod restarts before attributing the restriction to an application rate limit.

## Maintenance and recovery

The chart configures one LAPI, one processor, and one AppSec process, each with Recreate strategy. Plan an interruption to the corresponding function during updates. Preserve the LAPI backup and required identity material; confirm detection and enforcement after restore.

Azure's CrowdSec engine and nftables bouncer follow [the edge runbook](/admin-guide/azure-edge/). Changing the Kubernetes Application does not update that guest or the separately managed firewall system.
