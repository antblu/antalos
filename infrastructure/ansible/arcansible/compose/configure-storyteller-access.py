"""Configure native Storyteller group permissions, optionally sync linked users.

Run on debian-arc as root. --identities reads the Authentik snapshot from stdin.
Preserves provider ID, client credentials, existing links and local-only users.
"""
import argparse
import json
import re
import sqlite3
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--database', default='/opt/compose/data/storyteller/storyteller.db')
parser.add_argument('--identities', action='store_true')
args = parser.parse_args()
identities = json.load(sys.stdin) if args.identities else []
permissions = ['bookRead', 'bookDownload', 'bookList', 'bookCreate', 'bookDelete', 'bookProcess',
               'bookUpdate', 'collectionCreate', 'inviteList', 'inviteDelete', 'userCreate',
               'userList', 'userRead', 'userDelete', 'userUpdate', 'userPasswordReset', 'settingsUpdate']
connection = sqlite3.connect(args.database, timeout=30)
with connection:
    rows = connection.execute("SELECT uuid,value FROM settings WHERE name='authProviders'").fetchall()
    if len(rows) != 1:
        raise RuntimeError('Expected one Storyteller authentication-provider setting')
    setting_id, value = rows[0]
    providers = json.loads(value)
    matches = [p for p in providers if p.get('issuer', '').rstrip('/').endswith('/application/o/storyteller')]
    if len(matches) != 1:
        raise RuntimeError('Expected one existing Storyteller Authentik provider')
    provider = matches[0]
    if provider['kind'] == 'built-in':
        # customProviderId("Authentik") == "authentik": callbacks and existing
        # account links retain exactly the same ID as the built-in provider.
        if provider.get('id') != 'authentik':
            raise RuntimeError('Review existing built-in provider before converting it')
        provider.update(kind='custom', name='Authentik', type='oidc')
        provider.pop('id')
    provider_id = re.sub('[^a-zA-Z0-9-]', '', re.sub(' +', '-', provider['name'].lower()))
    provider['allowRegistration'] = True
    group_permissions = provider.get('groupPermissions') or {}
    group_permissions.update({'storyteller-users': ['bookRead', 'bookDownload', 'bookList'],
                              'storyteller-admins': permissions})
    provider['groupPermissions'] = group_permissions
    updated = json.dumps(providers, separators=(',', ':'))
    if json.loads(value) != providers:
        connection.execute('UPDATE settings SET value=?,updated_at=CURRENT_TIMESTAMP WHERE uuid=?', (updated, setting_id))
    emails = {}
    for identity in identities:
        email = identity['email'].lower()
        if email in emails:
            raise RuntimeError('Ambiguous Authentik email')
        emails[email] = set(identity['groups'])
    changes = 0
    for email, permission_id in connection.execute(
        'SELECT u.email,u.user_permission_uuid FROM user u JOIN account a ON a.user_id=u.id WHERE a.provider=?',
        (provider_id,)):
        groups = emails.get(email.lower())
        if groups is None:
            continue
        granted = {permission for group in groups for permission in group_permissions.get(group, [])}
        fields = {re.sub(r'(?<!^)(?=[A-Z])', '_', permission).lower(): int(permission in granted)
                  for permission in permissions}
        stored = connection.execute('SELECT '+','.join(fields)+' FROM user_permission WHERE uuid=?', (permission_id,)).fetchone()
        values = tuple(fields.values())
        if stored != values:
            connection.execute('UPDATE user_permission SET '+','.join(key+'=?' for key in fields)+
                               ',updated_at=CURRENT_TIMESTAMP WHERE uuid=?', values+(permission_id,))
            changes += 1
print(f'Storyteller provider configured; {changes} linked account permissions synchronized')
