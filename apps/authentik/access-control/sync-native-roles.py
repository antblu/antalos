"""Reconcile native roles that cannot synchronize existing users at SSO login.

Uses existing kubectl/kubeconfig and SSH aliases; never copies service secrets.
Execute from the checkout containing the private kubeconfig, or pass --root.
"""
import argparse
import base64
import json
import subprocess
import re
import select
import time
import sys
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
# Use a temporary loopback-only tunnel to the existing native API. No new
# network exposure or copied credentials; the Stalwart helper reads its existing
# bootstrap Secret privately and matches accounts by exact Authentik email.
forward = subprocess.Popen(command + ['-n', 'stalwart', 'port-forward',
    '--address=127.0.0.1', 'service/stalwart-web', ':8080'],
    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=root)
try:
    deadline = time.monotonic() + 30
    port = None
    while time.monotonic() < deadline and forward.poll() is None:
        if select.select([forward.stdout], [], [], 1)[0]:
            match = re.search(r'Forwarding from 127\.0\.0\.1:(\d+) -> 8080', forward.stdout.readline())
            if match:
                port = match.group(1)
                break
    if not port:
        raise RuntimeError('Stalwart API tunnel did not become ready')
    subprocess.run([sys.executable, str(source/'apps/stalwart/tools/reconcile-access.py'),
        '--root', str(root), '--identities', '--apply', '--url',
        'http://127.0.0.1:' + port + '/jmap/'], input=payload, text=True, check=True, cwd=root)
finally:
    forward.terminate()
    try:
        forward.wait(timeout=5)
    except subprocess.TimeoutExpired:
        forward.kill()
        forward.wait()
    forward.stdout.close()

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
