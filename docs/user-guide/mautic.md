---
title: Mautic
description: Access Mautic and work with marketing contacts, segments and campaigns.
---

Open [Mautic SSO](https://mautic.antblu.net/saml/discovery) and sign in through antID
(Authentik).
Access requires membership in `Mautic Users` or `authentik Admins`. The first SAML
login creates a Mautic account with the non-admin `SSO Users` role; an administrator
must grant that role the required application permissions. Existing matching Mautic
accounts retain their assigned role. Local recovery sign-in remains available at
[/s/login](https://mautic.antblu.net/s/login).

Use contacts and segments to organize an audience, then build campaigns and email
content. Ask the administrator to complete mail delivery configuration before
launching a campaign. The initial deployment discards outbound email until a real
transport is configured; a completed queue job alone does not establish delivery.

For installation, scheduling or delivery issues, use the
[Mautic administrator guide](/admin-guide/mautic/).
