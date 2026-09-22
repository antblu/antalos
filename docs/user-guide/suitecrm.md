---
title: "SuiteCRM · Use"
description: "What SuiteCRM does, how to use it in Antalos, and where to find its official documentation."
---

<nav class="guide-switcher" aria-label="SuiteCRM guide sections"><a aria-current="page" href="/user-guide/suitecrm/">Use</a><a href="/infrastructure/suitecrm/">Architecture</a><a href="/admin-guide/suitecrm/">Operate</a></nav>

SuiteCRM tracks customer relationships through leads, contacts, accounts, opportunities, activities, and cases. Antalos uses a custom packaged SuiteCRM image with password login and optional Authentik SAML sign-in. CRM access and record visibility are controlled by roles and security groups inside SuiteCRM.

## Access and audience

For this installation, use [crm.antblu.net](https://crm.antblu.net). If you use another Antalos installation, open the address supplied by its administrator. Ask for the account or role you need before starting.

## Your first workflow

1. Enter your SuiteCRM username and password, or choose **Sign in with SSO** to use Authentik. SSO-created accounts use Authentik unless an administrator explicitly enables a local password. Then select the relevant module, such as Accounts, Contacts, or Leads.

2. Search for an existing record before creating a duplicate. Link a contact to the correct account and record the next activity or follow-up.

3. Use tasks, calls, meetings, and notes to keep the customer history understandable to the rest of the team.

4. Move opportunities through the team’s defined sales stages and use saved filters or reports to review assigned work. Ask an administrator before large imports or mass updates.

## Get help

Include the record type and action, such as opening a contact, saving an opportunity, or uploading an attachment. Do not repeatedly create the same record when the first save has an uncertain result.

## During an interruption

Saving records, background tasks, and attachments may recover at different times. Check the existing record before repeating an uncertain save.

Administrators can read [the architecture and recovery limits](/infrastructure/suitecrm/#availability-and-failure-behavior).

## Official documentation

Use the [official SuiteCRM documentation](https://docs.suitecrm.com/user/) for the complete feature reference. Some features depend on the installed version and options. If the manual differs from what you see, ask your administrator which version and features are enabled.

For Antalos-specific state and availability, continue to [Infrastructure Explanation](/infrastructure/suitecrm/). For installation and integration setup, use [Deployment and Admin Guide](/admin-guide/suitecrm/).
