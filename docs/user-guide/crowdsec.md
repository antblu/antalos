---
title: CrowdSec · Use
description: Understand why a request can be blocked and what to report to an administrator.
---

<nav class="guide-switcher" aria-label="CrowdSec guides"><a aria-current="page" href="/user-guide/crowdsec/">Use</a><a href="/infrastructure/crowdsec/">Architecture</a><a href="/admin-guide/crowdsec/">Operate</a></nav>

CrowdSec helps protect services by detecting suspicious activity and supplying decisions that an enforcement component can apply. It works behind the scenes; ordinary users do not need a CrowdSec account to use antalos. See the [official introduction](https://docs.crowdsec.net/docs/intro/) for the product's components.

## If a normal request is blocked

Record the service address, approximate time, visible error, and the action you were trying to perform. Send those details to the administrator. If useful, identify whether you were on a home, mobile, workplace, or private-network connection.

Avoid repeated retries that produce the same error. A blocked request might come from CrowdSec, the identity policy, the application itself, or another network layer; the administrator needs to identify which one responded.

## Access and permissions still belong to the application

An allowed request does not grant an application account or role. A successful Authentik sign-in does not guarantee that every request will be accepted by other protection layers. For sign-in help, use [accounts and access](/user-guide/accounts/).

## Official documentation

Read the [CrowdSec introduction](https://docs.crowdsec.net/docs/intro/) for detection and enforcement concepts. Administrators can use the [antalos CrowdSec runbook](/admin-guide/crowdsec/) to locate the cluster components and distinguish them from the edge firewall.
