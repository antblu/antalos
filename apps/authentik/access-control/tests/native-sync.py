"""Contract test for Storyteller's native provider and existing-user migration."""
import ast
import json
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[4]
program = root/'infrastructure/ansible/arcansible/compose/configure-storyteller-access.py'
module = ast.parse(program.read_text())
permissions = ast.literal_eval(next(node.value for node in module.body if isinstance(node, ast.Assign)
    and any(isinstance(target,ast.Name) and target.id=='permissions' for target in node.targets)))
import re
fields = [re.sub(r'(?<!^)(?=[A-Z])','_',name).lower() for name in permissions]
with tempfile.TemporaryDirectory(prefix='antalos-authorization-test-') as temporary:
    database = Path(temporary)/'storyteller.db'
    connection = sqlite3.connect(database)
    connection.executescript('''CREATE TABLE settings(uuid TEXT,name TEXT,value TEXT,updated_at TEXT);
        CREATE TABLE user(id TEXT,email TEXT,user_permission_uuid TEXT);
        CREATE TABLE account(user_id TEXT,provider TEXT);''')
    connection.execute('CREATE TABLE user_permission(uuid TEXT,updated_at TEXT,'+','.join(f+' INTEGER' for f in fields)+')')
    providers=[{'kind':'built-in','id':'authentik','issuer':'https://identity.example/application/o/storyteller/',
                'clientId':'retained-client','clientSecret':'fixture-only-secret'}]
    connection.execute('INSERT INTO settings VALUES(?,?,?,NULL)',('setting','authProviders',json.dumps(providers)))
    for identifier in ('administrator','ordinary','local'):
        connection.execute('INSERT INTO user VALUES(?,?,?)',(identifier,identifier+'@example.invalid',identifier))
        connection.execute('INSERT INTO user_permission(uuid) VALUES(?)',(identifier,))
        if identifier!='local':connection.execute('INSERT INTO account VALUES(?,?)',(identifier,'authentik'))
    connection.commit()
    snapshot=[{'email':'administrator@example.invalid','groups':['storyteller-users','storyteller-admins']},
              {'email':'ordinary@example.invalid','groups':['storyteller-users']}]
    command=[sys.executable,str(program),'--database',str(database),'--identities']
    subprocess.run(command,input=json.dumps(snapshot),text=True,check=True)
    provider=json.loads(connection.execute('SELECT value FROM settings').fetchone()[0])[0]
    assert provider['kind']=='custom' and provider['name']=='Authentik'
    assert provider['clientSecret']=='fixture-only-secret' and provider['clientId']=='retained-client'
    assert connection.execute("SELECT settings_update FROM user_permission WHERE uuid='administrator'").fetchone()[0]==1
    assert connection.execute("SELECT settings_update,book_read FROM user_permission WHERE uuid='ordinary'").fetchone()==(0,1)
    assert connection.execute("SELECT settings_update FROM user_permission WHERE uuid='local'").fetchone()[0] is None
    snapshot[0]['groups']=['storyteller-users']
    subprocess.run(command,input=json.dumps(snapshot),text=True,check=True)
    assert connection.execute("SELECT settings_update FROM user_permission WHERE uuid='administrator'").fetchone()[0]==0
    result=subprocess.run(command,input=json.dumps(snapshot),text=True,check=True,capture_output=True)
    assert '0 linked account permissions' in result.stdout
print('NATIVE_SYNC_CHECK provider identity, grant, removal, local-account preservation and idempotency passed')
