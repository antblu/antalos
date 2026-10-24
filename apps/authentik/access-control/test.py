"""Execute after reconcile.py in the same rollback-only ak shell transaction."""
from django.test import RequestFactory
from authentik.policies.engine import PolicyEngine

for username in ('estefania.cc', 'emiliany-admin'):
    person = User.objects.get(username=username)
    request = RequestFactory().get('/')
    request.user = person
    for slug in ('mautic', 'medusa', 'zammad', 'odoo', 'stalwart'):
        app = Application.objects.get(slug=slug)
        engine = PolicyEngine(app, person, request)
        engine.use_cache = False
        engine.build()
        assert engine.result.passing, (username, slug, engine.result)
        provider = app.get_provider()
        if isinstance(provider, OAuth2Provider):
            profile = ScopeMapping.objects.get(name=f'antalos {slug}: effective profile')
            claims = profile.evaluate(person, request, provider=provider)
            assert f'{slug}-users' in claims['groups']
            assert (f'{slug}-admins' in claims['groups']) == (slug != 'stalwart')
            roles = ScopeMapping.objects.get(name=f'antalos {slug}: application roles')
            assert roles.evaluate(person, request, provider=provider)['application_role'] == (
                'user' if slug == 'stalwart' else 'admin')
            if slug == 'stalwart':
                mail_mapping = ScopeMapping.objects.get(name='antalos stalwart: mail groups')
                assert mail_mapping.evaluate(person, request, provider=provider)['stalwart_groups'] == [
                    'stalwart-users@' + os.environ['STALWART_AUTH_GROUP_DOMAIN']]
        elif isinstance(provider, SAMLProvider):
            mapping = SAMLPropertyMapping.objects.get(name=f'antalos {slug}: effective groups')
            assert f'{slug}-admins' in mapping.evaluate(person, request, provider=provider)
    print(f'ACCESS_CHECK {username}: application policy and emitted claims passed')

# Repeated reconciliation must retain identity fields and each independently
# configured mapping even though several mappings share the profile scope.
expressions = dict(ScopeMapping.objects.values_list("name", "expression"))
counts = (Group.objects.count(), ScopeMapping.objects.count(), PolicyBinding.objects.count())
reconcile()
assert counts == (Group.objects.count(), ScopeMapping.objects.count(), PolicyBinding.objects.count())
assert expressions == dict(ScopeMapping.objects.values_list("name", "expression"))
operator = User.objects.get(username='antblu')
request = RequestFactory().get('/')
request.user = operator
for app in Application.objects.filter(provider__isnull=False):
    provider = app.get_provider()
    if not isinstance(provider, OAuth2Provider):
        continue
    mapping = ScopeMapping.objects.get(name=f'antalos {app.slug}: effective profile')
    claims = mapping.evaluate(operator, request, provider=provider)
    assert claims.get('preferred_username') == operator.username, app.slug
    assert 'groups' in claims, app.slug
    assert provider.property_mappings.filter(pk=mapping.pk).exists(), app.slug
    roles = ScopeMapping.objects.get(name=f'antalos {app.slug}: application roles')
    assert provider.property_mappings.filter(pk=roles.pk).exists(), app.slug
print('ACCESS_CHECK repeat reconciliation preserves identities, effective groups and role mappings')

outsider = User.objects.create(username='antalos-transaction-only-outsider', is_active=True)
for app in Application.objects.exclude(slug__in=PUBLIC):
    engine = PolicyEngine(app, outsider)
    engine.use_cache = False
    engine.build()
    assert not engine.result.passing, app.slug
print('ACCESS_CHECK outsider denied for every restricted application')

# A single umbrella membership must be sufficient; no direct per-app groups.
for label, umbrella, administrator in (
    ('admin', GLOBAL_ADMINS, True), ('user', GLOBAL_USERS, False),
):
    person = User.objects.create(username='antalos-transaction-global-' + label, is_active=True)
    person.groups.add(Group.objects.get(name=umbrella))
    assert person.groups.count() == 1
    assert person.is_superuser == administrator
    effective = set(person.all_groups().values_list('name', flat=True))
    for app in Application.objects.all():
        prefix = GROUP_PREFIX.get(app.slug, app.slug)
        assert prefix + '-users' in effective, (label, app.slug)
        assert (prefix + '-admins' in effective) == administrator, (label, app.slug)
        engine = PolicyEngine(app, person)
        engine.use_cache = False
        engine.build()
        assert engine.result.passing == (administrator or app.slug not in ADMIN_ONLY), (label, app.slug)
    print('ACCESS_CHECK global ' + label + ': single-group membership and privilege boundaries passed')

person = User.objects.create(username='antalos-transaction-app-admin', is_active=True)
for app in Application.objects.all():
    prefix = GROUP_PREFIX.get(app.slug, app.slug)
    person.groups.set([Group.objects.get(name=prefix + '-admins')])
    assert person.all_groups().filter(name=prefix + '-users').exists(), app.slug
    assert not person.is_superuser, app.slug
    engine = PolicyEngine(app, person)
    engine.use_cache = False
    engine.build()
    assert engine.result.passing, app.slug
print('ACCESS_CHECK every app admin alone inherits user access without Authentik superuser privileges')
operator = User.objects.get(username='antblu')
assert operator.groups.filter(name=GLOBAL_ADMINS).exists() and operator.is_superuser
print('ACCESS_CHECK antblu has the global administrator group and Authentik superuser access')
