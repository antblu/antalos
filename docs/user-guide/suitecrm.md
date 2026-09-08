---
title: "SuiteCRM \u00b7 Overview and User Guide"
description: "What SuiteCRM does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="SuiteCRM guide sections"><a aria-current="page" href="/user-guide/suitecrm/">Overview and User Guide</a><a href="/infrastructure/suitecrm/">Infrastructure Explanation</a><a href="/admin-guide/suitecrm/">Deployment and Admin Guide</a></nav>

SuiteCRM tracks customer relationships through leads, contacts, accounts, opportunities, activities, and cases. Antalos uses a custom packaged SuiteCRM image and Authentik SAML sign-in. CRM access and record visibility are controlled by roles and security groups inside SuiteCRM.

## Access and audience

The public address is defined by `SUITECRM_HOST` in `apps/variables.yaml`. Use your deployment’s value; Antalos hostnames are examples for a fork.

## Your first workflow

1. Sign in through the configured SAML provider and select the relevant module, such as Accounts, Contacts, or Leads.

2. Search for an existing record before creating a duplicate. Link a contact to the correct account and record the next activity or follow-up.

3. Use tasks, calls, meetings, and notes to keep the customer history understandable to the rest of the team.

4. Move opportunities through the team’s defined sales stages and use saved filters or reports to review assigned work. Ask an administrator before large imports or mass updates.

## When you need an administrator

For database startup failures, inspect Galera quorum, PVC placement, and arbitrator compatibility. NFS permission errors need export-side ownership analysis; recursively changing ownership on populated shared storage can be disruptive. SAML failures require checking assertion signatures, entity IDs, and username mapping.

## Official documentation

Use the [official SuiteCRM documentation](https://docs.suitecrm.com/user/) for the complete feature reference. Select documentation matching the version pinned in `apps/variables.yaml`; upstream “latest” documentation can describe a newer release.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/suitecrm/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/suitecrm/).
