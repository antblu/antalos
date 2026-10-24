"""Synchronize native Stalwart roles from effective Authentik membership.

Plan by default; --apply promotes AND demotes matched existing accounts. OIDC
claimGroups synchronizes memberships, but Stalwart does not inherit system
permissions from group roles. Native User.roles must therefore be synchronized.
"""
import argparse
import base64
import json
import subprocess
import urllib.request
from pathlib import Path

import yaml


def reconcile(api, identities, domain_name, apply=False):
    def unique(items, description):
        if len(items) != 1:
            raise RuntimeError(f'Expected one {description}; found {len(items)}')
        return items[0]


    changed = False
    accounts = api('Account', 'get')['list']
    directories = api('Directory', 'get')['list']
    authentication = unique(api('Authentication', 'get')['list'], 'authentication singleton')
    directory = unique([d for d in directories if d['id'] == authentication['directoryId']
                        and d['@type'] == 'Oidc'], 'active OIDC directory')
    # Match the default mail domain by the checked-in public shared input.
    domain = unique([d for d in api('Domain', 'get')['list'] if d['name'] == domain_name], 'mail domain')
    roles = api('Role', 'get')['list']
    admin_role = unique([r for r in roles if r['description'] == 'System Administrator'], 'system admin role')
    group_ids = {}
    for name, role in [('stalwart-users', {'@type': 'Default'}),
                       ('stalwart-admins', {'@type': 'Custom', 'roleIds': {admin_role['id']: True}})]:
        matches = [a for a in accounts if a['@type'] == 'Group' and a['name'] == name
                   and a['domainId'] == domain['id']]
        if len(matches) > 1:
            raise RuntimeError('Ambiguous Stalwart authorization group')
        if matches:
            group_ids[name] = matches[0]['id']
            if matches[0]['roles'] != role:
                print(f'Update {name} role')
                if apply:
                    api('Account', 'set', {'update': {matches[0]['id']: {'roles': role}}})
                    changed = True
        else:
            print(f'Create {name}')
            if apply:
                created = api('Account', 'set', {'create': {'group': {
                    '@type': 'Group', 'name': name, 'domainId': domain['id'],
                    'roles': role, 'permissions': {'@type': 'Inherit'},
                }}})['created']['group']
                group_ids[name] = created['id']
                changed = True
            else:
                group_ids[name] = '<new-' + name + '>'
    if directory.get('claimGroups') != 'stalwart_groups':
        print('Enable application-scoped OIDC group claim on existing directory')
        if apply:
            api('Directory', 'set', {'update': {directory['id']: {'claimGroups': 'stalwart_groups'}}})
            changed = True
    for account in accounts:
        identity = identities.get(account.get('emailAddress', '').lower())
        if account['@type'] != 'User' or not identity:
            continue
        if account.get('permissions', {}).get('@type') != 'Inherit':
            raise RuntimeError('Matched account has explicit permissions; review before migration')
        memberships = dict(account.get('memberGroupIds', {}))
        if identity['user']:
            memberships[group_ids['stalwart-users']] = True
        else:
            memberships.pop(group_ids['stalwart-users'], None)
        if identity['admin']:
            memberships[group_ids['stalwart-admins']] = True
        else:
            memberships.pop(group_ids['stalwart-admins'], None)
        desired = {'roles': {'@type': 'Admin' if identity['admin'] else 'User'}, 'memberGroupIds': memberships}
        if any(account.get(key) != value for key, value in desired.items()):
            print(f'Synchronize {account["emailAddress"]}: {"administrator" if identity["admin"] else "standard user"}')
            if apply:
                api('Account', 'set', {'update': {account['id']: desired}})
                changed = True
    if apply and changed:
        api('Action', 'set', {'create': {'reload': {'@type': 'ReloadSettings'}}})
    print('Stalwart access migration complete' if apply else 'Plan only; no changes applied')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:18080/jmap/')
    parser.add_argument('--root', default='.', help='Private checkout containing kubeconfig')
    parser.add_argument('--identities', action='store_true', help='Read the controller snapshot from stdin')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    root = Path(args.root).resolve()
    source = Path(__file__).resolve().parents[3]
    command = ['/home/linuxbrew/.linuxbrew/bin/kubectl', '--kubeconfig', str(root / 'kubeconfig')]

    def kubectl(*arguments):
        return subprocess.check_output(command + list(arguments), text=True, stderr=subprocess.PIPE)

    if args.identities:
        import sys
        rows = json.load(sys.stdin)
    else:
        query = '''import json
from authentik.core.models import User
rows=[{"email":u.email.lower(),"groups":list(u.all_groups().values_list("name",flat=True)) if u.is_active else []} for u in User.objects.filter(type="internal").exclude(email="")]
print("AUTH_ACCESS_SNAPSHOT:"+json.dumps(rows))'''
        output = kubectl('-n', 'authentik', 'exec', 'deploy/authentik-worker', '--', 'ak', 'shell', '-c', query)
        rows = json.loads(next(line.removeprefix('AUTH_ACCESS_SNAPSHOT:') for line in output.splitlines()
                               if line.startswith('AUTH_ACCESS_SNAPSHOT:')))
    identities = {}
    for row in rows:
        email = row['email'].lower()
        if email in identities:
            raise RuntimeError('Ambiguous Authentik email; refusing role synchronization')
        identities[email] = {'user': 'stalwart-users' in row['groups'],
                             'admin': 'stalwart-admins' in row['groups']}
    secret = json.loads(kubectl('-n', 'stalwart', 'get', 'secret', 'stalwart-bootstrap-admin', '-o', 'json'))
    password = base64.b64decode(secret['data']['password']).decode()
    authorization = 'Basic ' + base64.b64encode(('administrator:' + password).encode()).decode()

    def api(object_name, action, values=None):
        name = f'x:{object_name}/{action}'
        request = urllib.request.Request(args.url, data=json.dumps({
            'using': ['urn:ietf:params:jmap:core', 'urn:stalwart:jmap'],
            'methodCalls': [[name, values or {}, 'access']],
        }).encode(), headers={'Authorization': authorization, 'Content-Type': 'application/json'})
        response = json.load(urllib.request.urlopen(request, timeout=30))['methodResponses'][0]
        if response[0] != name or any(response[1].get(key) for key in ('notCreated', 'notUpdated', 'notDestroyed')):
            raise RuntimeError(f'{name} failed')
        return response[1]

    variables = yaml.safe_load((source / 'apps/variables.yaml').read_text())['variables']
    reconcile(api, identities, variables['MAIL_DOMAIN'], args.apply)


if __name__ == '__main__':
    main()
