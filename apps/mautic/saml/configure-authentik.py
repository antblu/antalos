"""Run through `ak shell`; inputs are public hostnames from apps/variables.yaml."""

import os

from django.db import transaction
from authentik.core.models import Application, Group
from authentik.crypto.models import CertificateKeyPair
from authentik.flows.models import Flow
from authentik.policies.models import PolicyBinding
from authentik.providers.saml.models import SAMLPropertyMapping, SAMLProvider

site = "https://" + os.environ["MAUTIC_HOST"]
identity = "https://" + os.environ["AUTHENTIK_HOST"]

with transaction.atomic():
    mappings = []
    for field, expression in {
        "email": "return request.user.email",
        "username": "return request.user.username",
        "firstname": "return request.user.attributes.get('first_name') or request.user.name.split(' ')[0] or request.user.username",
        "lastname": "return request.user.attributes.get('last_name') or ' '.join(request.user.name.split(' ')[1:]) or request.user.name or request.user.username",
    }.items():
        mapping, _ = SAMLPropertyMapping.objects.update_or_create(
            name=f"Mautic SAML: {field}",
            defaults={"saml_name": field, "expression": expression},
        )
        mappings.append(mapping)

    provider, _ = SAMLProvider.objects.update_or_create(
        name="Provider for Mautic",
        defaults={
            "authentication_flow": Flow.objects.get(slug="normal-authentication-flow"),
            "authorization_flow": Flow.objects.get(slug="default-provider-authorization-implicit-consent"),
            "invalidation_flow": Flow.objects.get(slug="default-provider-invalidation-flow"),
            "acs_url": site + "/s/saml/login_check",
            "audience": site,
            "issuer_override": identity + "/application/saml/mautic/metadata/",
            "sp_binding": "post",
            "sign_assertion": True,
            "sign_response": True,
            "signing_kp": CertificateKeyPair.objects.get(name="authentik Self-signed Certificate"),
        },
    )
    provider.property_mappings.set(mappings)
    application, _ = Application.objects.update_or_create(
        slug="mautic",
        defaults={
            "name": "Mautic",
            "provider": provider,
            "meta_launch_url": site + "/saml/discovery",
            "policy_engine_mode": "any",
        },
    )
    users, _ = Group.objects.get_or_create(name="Mautic Users")
    admins = Group.objects.get(name="authentik Admins")
    for order, group in enumerate((users, admins)):
        PolicyBinding.objects.update_or_create(
            target=application, group=group,
            defaults={"order": order, "enabled": True},
        )

print("Configured Mautic SAML provider and Mautic Users / authentik Admins access.")
