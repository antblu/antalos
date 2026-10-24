"""Migrate existing Stalwart accounts to Authentik-owned group authorization.

Run from repository root while forwarding Stalwart HTTP locally. By default,
print a credential-free plan; --apply changes only owned groups, OIDC group
mapping and roles of accounts matched by exact Authentik-managed email.
"""
import argparse
import base64
import json
import subprocess
import urllib.request
from pathlib import Path

import yaml

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:18080/jmap/')
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
KUBECTL = ['/home/linuxbrew/.linuxbrew/bin/kubectl', '--kubeconfig', 'kubeconfig']


def kubectl(*arguments):
    return subprocess.check_output(KUBECTL + list(arguments), text=True, stderr=subprocess.PIPE)


# Only public identity/authorization data leaves the identity pod.
query = '''import json
from authentik.core.models import User
rows=[]
for user in User.objects.filter(is_active=True, type="internal").exclude(email=""):
    groups=set(user.all_groups().values_list("name",flat=True))
    rows.append({"email":user.email.lower(),"user":"stalwart-users" in groups,"admin":"stalwart-admins" in groups})
print("AUTH_ACCESS_SNAPSHOT:"+json.dumps(rows))'''
output = kubectl('-n', 'authentik', 'exec', 'deploy/authentik-worker', '--', 'ak', 'shell', '-c', query)
rows = json.loads(next(line.removeprefix('AUTH_ACCESS_SNAPSHOT:') for line in output.splitlines()
                       if line.startswith('AUTH_ACCESS_SNAPSHOT:')))
identities = {}
for row in rows:
    if row['email'] in identities:
        raise RuntimeError('Ambiguous Authentik email; refusing role migration')
    identities[row['email']] = row
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
        # Do not echo response bodies: other API methods can contain credentials.
        raise RuntimeError(f'{name} failed')
    return response[1]


def unique(items, description):
    if len(items) != 1:
        raise RuntimeError(f'Expected one {description}; found {len(items)}')
    return items[0]


accounts = api('Account', 'get')['list']
directories = api('Directory', 'get')['list']
authentication = unique(api('Authentication', 'get')['list'], 'authentication singleton')
directory = unique([d for d in directories if d['id'] == authentication['directoryId']
                    and d['@type'] == 'Oidc'], 'active OIDC directory')
# Match the default mail domain by the checked-in public shared input.
domain_name = yaml.safe_load(Path('apps/variables.yaml').read_text())['variables']['MAIL_DOMAIN']
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
            if args.apply:
                api('Account', 'set', {'update': {matches[0]['id']: {'roles': role}}})
    else:
        print(f'Create {name}')
        if args.apply:
            created = api('Account', 'set', {'create': {'group': {
                '@type': 'Group', 'name': name, 'domainId': domain['id'],
                'roles': role, 'permissions': {'@type': 'Inherit'},
            }}})['created']['group']
            group_ids[name] = created['id']
        else:
            group_ids[name] = '<new-' + name + '>'
if directory.get('claimGroups') != 'stalwart_groups':
    print('Enable application-scoped OIDC group claim on existing directory')
    if args.apply:
        api('Directory', 'set', {'update': {directory['id']: {'claimGroups': 'stalwart_groups'}}})
for account in accounts:
    identity = identities.get(account.get('emailAddress', '').lower())
    if account['@type'] != 'User' or not identity or not identity['user']:
        continue
    if account.get('permissions', {}).get('@type') != 'Inherit':
        raise RuntimeError('Matched account has explicit permissions; review before migration')
    memberships = dict(account.get('memberGroupIds', {}))
    memberships[group_ids['stalwart-users']] = True
    if identity['admin']:
        memberships[group_ids['stalwart-admins']] = True
    else:
        memberships.pop(group_ids['stalwart-admins'], None)
    desired = {'roles': {'@type': 'User'}, 'memberGroupIds': memberships}
    if any(account.get(key) != value for key, value in desired.items()):
        print(f'Synchronize {account["emailAddress"]}: {"administrator" if identity["admin"] else "standard user"}')
        if args.apply:
            api('Account', 'set', {'update': {account['id']: desired}})
if args.apply:
    api('Action', 'set', {'create': {'reload': {'@type': 'ReloadSettings'}}})
print('Stalwart access migration complete' if args.apply else 'Plan only; no changes applied')
