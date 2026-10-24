"""Configure the existing Home Assistant OIDC integration via its native API.

Set HOME_ASSISTANT_TOKEN privately to an administrator token. No credential,
provider ID, user link or local login method is changed by this operation.
"""
import json
import os
import urllib.request

base = os.environ['HOME_ASSISTANT_URL'].rstrip('/')
token = os.environ['HOME_ASSISTANT_TOKEN']


def api(path, payload=None):
    request = urllib.request.Request(base + path, headers={
        'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
        data=json.dumps(payload).encode() if payload is not None else None)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


entries = [entry for entry in api('/api/config/config_entries/entry') if entry['domain'] == 'auth_oidc']
if len(entries) != 1:
    raise RuntimeError('Expected one existing Home Assistant OIDC integration')
flow = api('/api/config/config_entries/options/flow', {'handler': entries[0]['entry_id']})
if flow.get('type') != 'form':
    raise RuntimeError('Unexpected Home Assistant OIDC options flow')
values = {}
for field in flow['data_schema']:
    name = field['name']
    if 'default' in field:
        values[name] = field['default']
    elif 'suggested_value' in field.get('description', {}):
        values[name] = field['description']['suggested_value']
    elif name == 'enable_user_linking':
        # Preserve the integration default instead of enabling identity relinking.
        values[name] = False
    elif field.get('required'):
        raise RuntimeError('Required OIDC option has no current value: ' + name)
values.update(enable_groups=True, admin_group='home-assistant-admins', user_group='home-assistant-users')
result = api('/api/config/config_entries/options/flow/' + flow['flow_id'], values)
if result.get('type') != 'create_entry':
    raise RuntimeError('Home Assistant rejected the group-role options')
print('Home Assistant OIDC groups configured; credentials and user links preserved')
