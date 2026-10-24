"""Reconcile native roles that cannot synchronize existing users at SSO login.

Uses existing kubectl/kubeconfig and SSH aliases; never copies service secrets.
Execute from the checkout containing the private kubeconfig, or pass --root.
"""
import argparse
import base64
import json
import subprocess
from pathlib import Path

import yaml

parser = argparse.ArgumentParser()
parser.add_argument('--root', default='.')
args = parser.parse_args()
root = Path(args.root).resolve()
source = Path(__file__).resolve().parents[3]
command = ['/home/linuxbrew/.linuxbrew/bin/kubectl', '--kubeconfig', str(root / 'kubeconfig')]
query = '''import json
from authentik.core.models import User
rows=[{"email":u.email.lower(),"groups":list(u.all_groups().values_list("name",flat=True)) if u.is_active else []} for u in User.objects.filter(type="internal").exclude(email="")]
print("AUTHORIZATION_SNAPSHOT:"+json.dumps(rows))'''
result = subprocess.run(command+['-n','authentik','exec','deploy/authentik-worker','--','ak','shell','-c',query],
                        capture_output=True,text=True,check=True,cwd=root)
identities = json.loads(next(line.split(':',1)[1] for line in result.stdout.splitlines()
                            if line.startswith('AUTHORIZATION_SNAPSHOT:')))
emails = [row['email'] for row in identities]
if len(emails) != len(set(emails)):
    raise RuntimeError('Ambiguous Authentik email; refusing native role synchronization')
variables = yaml.safe_load((source/'apps/variables.yaml').read_text())['variables']
payload = json.dumps(identities)
encoded = base64.b64encode(payload.encode()).decode()
# Query the current CNPG primary by its role label, rather than pinning a pod ID.
primary = json.loads(subprocess.check_output(command+['-n','cal-diy','get','pods','-l',
    'cnpg.io/cluster=cal-diy-db,role=primary','-o','json'],text=True,cwd=root))['items']
if len(primary) != 1:
    raise RuntimeError('Expected one Cal.diy primary')
subprocess.run(command+['-n','cal-diy','exec','-i',primary[0]['metadata']['name'],'--','psql',
    '-U','postgres','-d',variables['CALDIY_DATABASE_NAME'],'--set','ON_ERROR_STOP=1','--set','identities='+encoded],
    input=(source/'apps/cal-diy/tools/sync-roles.sql').read_text(),text=True,check=True,cwd=root)
# The program and identity snapshot use stdin; no token, password or identity
# value is interpolated into a shell command on the Debian guest.
program = (source/'infrastructure/ansible/arcansible/compose/configure-storyteller-access.py').read_text()
runner = 'import sys,io\nsys.argv=["configure-storyteller-access.py","--identities"]\nsys.stdin=io.StringIO('+repr(payload)+')\nexec(compile('+repr(program)+',"configure-storyteller-access.py","exec"))\n'
subprocess.run(['ssh','debian-arc','sudo python3 -'],input=runner,text=True,check=True,cwd=root)
