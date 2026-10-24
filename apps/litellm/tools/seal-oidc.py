"""Reuse the existing Authentik provider and seal its credentials for LiteLLM."""
import base64
import json
import subprocess
from pathlib import Path

output = Path('apps/litellm/oidc-secret.yaml')
if output.exists():
    raise SystemExit('Refusing to overwrite the existing sealed OIDC credentials')
command = ['/home/linuxbrew/.linuxbrew/bin/kubectl', '--kubeconfig', 'kubeconfig']
code = '''import json
from authentik.core.models import Application
p=Application.objects.get(slug="lite-llm").get_provider()
print("OIDC_CREDENTIALS:"+json.dumps({"client-id":p.client_id,"client-secret":p.client_secret}))'''
result = subprocess.run(command + ['-n', 'authentik', 'exec', 'deploy/authentik-worker', '--',
                                  'ak', 'shell', '-c', code], capture_output=True, text=True, check=True)
credentials = json.loads(next(line.split(':', 1)[1] for line in result.stdout.splitlines()
                             if line.startswith('OIDC_CREDENTIALS:')))
secret = {'apiVersion': 'v1', 'kind': 'Secret', 'metadata': {'name': 'litellm-oidc', 'namespace': 'litellm'},
          'data': {key: base64.b64encode(value.encode()).decode() for key, value in credentials.items()}}
sealed = subprocess.run(['/home/linuxbrew/.linuxbrew/bin/kubeseal', '--kubeconfig', 'kubeconfig',
                         '--controller-name', 'sealed-secrets-controller', '--controller-namespace', 'sealed-secrets',
                         '--format', 'yaml'], input=json.dumps(secret), capture_output=True, text=True, check=True)
output.write_text(sealed.stdout)
print('Sealed existing LiteLLM OIDC credentials without changing the provider')
