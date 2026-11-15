---
title: "SuiteCRM · Use"
description: "Sign in to SuiteCRM and work with accounts, contacts, and leads."
---

<nav class="guide-switcher" aria-label="SuiteCRM guide sections"><a aria-current="page" href="/user-guide/suitecrm/">Use</a><a href="/infrastructure/suitecrm/">Architecture</a><a href="/admin-guide/suitecrm/">Operate</a></nav>

SuiteCRM tracks customer relationships through leads, contacts, accounts, opportunities, activities, and cases. antalos uses a custom packaged SuiteCRM image with password login and optional Authentik SAML sign-in. CRM access and record visibility are controlled by roles and security groups inside SuiteCRM.

## Access

Open [crm.antblu.net](https://crm.antblu.net) or use the address your administrator gave you. Ask your administrator for access if you need an account or role.

## Work with a CRM record

1. Enter your SuiteCRM username and password, or choose **Sign in with SSO** to use Authentik. SSO-created accounts use Authentik unless an administrator explicitly enables a local password. Then select the relevant module, such as Accounts, Contacts, or Leads.

2. Search for an existing record before creating a duplicate. Link a contact to the correct account and record the next activity or follow-up.

3. Use tasks, calls, meetings, and notes to keep the customer history understandable to the rest of the team.

4. Move opportunities through the team’s defined sales stages and use saved filters or reports to review assigned work. Ask an administrator before large imports or mass updates.

## Get help

Include the record type and action, such as opening a contact, saving an opportunity, or uploading an attachment. Do not repeatedly create the same record when the first save has an uncertain result.

## During an interruption

Saving records, background tasks, and attachments may recover at different times. Check the existing record before repeating an uncertain save.

See [expected failure behavior and recovery](/infrastructure/suitecrm/#availability-and-failure-behavior).

## Official documentation

Use the [official SuiteCRM documentation](https://docs.suitecrm.com/user/) for your installed version. Ask your administrator which optional features are enabled.

See the [architecture](/infrastructure/suitecrm/) or [deployment guide](/admin-guide/suitecrm/).
