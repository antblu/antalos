#!/usr/bin/env python3
"""Create the Odoo catalog reader and seal its API key without printing it.

Run from the repository root. This deliberately creates an Odoo account/key;
it neither applies Kubernetes resources nor enables the product sync.
"""
import base64
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys

KUBECTL = "/home/linuxbrew/.linuxbrew/bin/kubectl"
KUBE_ARGS = [KUBECTL, "--kubeconfig", "kubeconfig", "--request-timeout=15s"]
OUTPUT = Path("apps/medusa/odoo-secret.yaml")
MARKER = "MEDUSA_ODOO_CREDENTIAL="

ODOO_SCRIPT = r'''
import json
from odoo import Command

issue_key = True
login = 'medusa-integration'
models = [
    'product.template', 'product.product', 'product.template.attribute.value',
    'product.attribute', 'product.attribute.value', 'res.currency',
    'res.company', 'uom.uom',
]
group = env.ref('medusa_integration.catalog_reader', raise_if_not_found=False)
user = env.ref('medusa_integration.user_catalog', raise_if_not_found=False)
if not user and env['res.users'].sudo().with_context(active_test=False).search_count([('login', '=', login)]):
    raise RuntimeError('Login already exists without the integration ownership marker; refusing to claim it')
if user and (user.login != login or not user.active):
    raise RuntimeError('Integration account was renamed or archived; review it before provisioning')
if issue_key and user and env['res.users.apikeys'].sudo().search_count([('user_id', '=', user.id)]):
    raise RuntimeError('Integration account already has an API key; reuse its sealed credential or revoke it deliberately')
if not group:
    group = env['res.groups'].sudo().create({'name': 'Medusa Catalog Reader', 'share': True})
    env['ir.model.data'].sudo().create({
        'module': 'medusa_integration', 'name': 'catalog_reader',
        'model': 'res.groups', 'res_id': group.id, 'noupdate': True,
    })
missing_models = []
available_models = []
for name in models:
    model = env['ir.model'].sudo().search([('model', '=', name)], limit=1)
    if not model:
        missing_models.append(name)
        continue
    available_models.append(name)
    access = env['ir.model.access'].sudo().search([('group_id', '=', group.id), ('model_id', '=', model.id)])
    values = {'name': 'Medusa reader ' + name, 'model_id': model.id, 'group_id': group.id,
              'perm_read': True, 'perm_write': False, 'perm_create': False, 'perm_unlink': False}
    if access:
        access.write(values)
    else:
        env['ir.model.access'].sudo().create(values)
if not user:
    user = env['res.users'].sudo().with_context(no_reset_password=True).create({
        'name': 'Medusa Integration', 'login': login,
        'group_ids': [Command.set(group.ids)],
        'company_id': env.company.id, 'company_ids': [Command.set(env.company.ids)],
    })
    env['ir.model.data'].sudo().create({
        'module': 'medusa_integration', 'name': 'user_catalog',
        'model': 'res.users', 'res_id': user.id, 'noupdate': True,
    })
if user.group_ids != group:
    raise RuntimeError('Integration account has unexpected group membership; refusing to issue a key')
# Check effective permissions, including ACLs from other installed addons.
access = env['ir.model.access'].with_user(user)
for model in available_models:
    if not access.check(model, 'read', raise_exception=False):
        raise RuntimeError('Missing read permission: ' + model)
    for mode in ('write', 'create', 'unlink'):
        if access.check(model, mode, raise_exception=False):
            raise RuntimeError('Unexpected mutation permission: ' + model + '/' + mode)
if issue_key:
    key = env['res.users.apikeys'].with_user(user).sudo()._generate(
        'rpc', 'Medusa catalog sync', False,
    )
    env.cr.commit()
    print('MEDUSA_ODOO_CREDENTIAL=' + json.dumps({'ODOO_USERNAME': login, 'ODOO_API_KEY': key}))
else:
    env.cr.commit()
print('MEDUSA_ODOO_PENDING=' + json.dumps(missing_models))
'''


def run(args, **kwargs):
    return subprocess.run(args, capture_output=True, text=True, check=True, **kwargs)


def run_odoo(script):
    pods = json.loads(run(KUBE_ARGS + ["-n", "odoo", "get", "pods", "-l",
                                      "app.kubernetes.io/name=odoo", "-o", "json"], timeout=25).stdout)
    ready = [pod for pod in pods['items'] if not pod['metadata'].get('deletionTimestamp')
             and any(c['type'] == 'Ready' and c['status'] == 'True' for c in pod['status'].get('conditions', []))]
    if not ready:
        raise RuntimeError("No ready Odoo pod is available")
    return run(KUBE_ARGS + ["-n", "odoo", "exec", "-i", ready[0]['metadata']['name'], "-c", "odoo", "--",
                           "odoo", "shell", "--config=/run/odoo/odoo.conf", "--no-http"], input=script, timeout=120)


def report_pending(result):
    marker = 'MEDUSA_ODOO_PENDING='
    lines = [line[len(marker):] for line in result.stdout.splitlines() if line.startswith(marker)]
    if len(lines) != 1:
        raise RuntimeError("Odoo did not confirm the catalog access state")
    missing = json.loads(lines[0])
    if missing:
        print('Catalog models are not installed; sync must remain disabled. Pending read ACLs: ' + ', '.join(missing))
        print('After catalog installation, run this tool with --reconcile-access; it will preserve the existing key.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reconcile-access', action='store_true', help='Reconcile read ACLs without issuing or rotating a key')
    parser.add_argument('--commerce-access', action='store_true', help='Grant existing integration user Sales, Inventory and bridge access; preserve its API key')
    args = parser.parse_args()
    if args.commerce_access:
        script = """
from odoo import Command
user = env.ref('medusa_integration.user_catalog')
if not user.active or user.login != 'medusa-integration':
    raise RuntimeError('Integration identity requires operator review')
for name in ('sale_management', 'sale_stock', 'medusa_bridge'):
    if env['ir.module.module'].search([('name', '=', name)]).state != 'installed':
        raise RuntimeError('Required commerce module missing: ' + name)
groups = [env.ref(name) for name in ('base.group_user', 'base.group_partner_manager', 'sales_team.group_sale_salesman', 'stock.group_stock_user', 'medusa_bridge.group_medusa_bridge')]
user.write({'group_ids': [Command.link(group.id) for group in groups]})
if user.has_group('base.group_system') or user.has_group('sales_team.group_sale_manager') or user.has_group('stock.group_stock_manager'):
    raise RuntimeError('Integration account unexpectedly has administrative access')
env.cr.commit()
print('COMMERCE_ACCESS_RECONCILED')
"""
        result = run_odoo(script)
        if 'COMMERCE_ACCESS_RECONCILED' not in result.stdout:
            raise RuntimeError('Commerce access was not confirmed')
        print('Reconciled commerce permissions without rotating the API key.')
        return
    if args.reconcile_access:
        result = run_odoo(ODOO_SCRIPT.replace('issue_key = True', 'issue_key = False'))
        report_pending(result)
        print('Reconciled Odoo catalog read permissions without changing the API key.')
        return
    if OUTPUT.exists():
        raise RuntimeError(f"{OUTPUT} already exists; refusing to replace integration credentials")
    kubeseal = shutil.which("kubeseal") or "/home/linuxbrew/.linuxbrew/bin/kubeseal"
    # Fetch the public sealing certificate before creating the nonrecoverable key.
    cert = run([kubeseal, "--kubeconfig", "kubeconfig", "--controller-name", "sealed-secrets-controller",
                "--controller-namespace", "sealed-secrets", "--fetch-cert"], timeout=30).stdout
    # Keep public certificate material in memory via a temporary file. Plaintext
    # credentials only cross process stdin/stdout pipes and never reach disk.
    import tempfile
    with tempfile.TemporaryDirectory(prefix="medusa-odoo-") as tmp:
        cert_path = Path(tmp) / "controller.pem"
        cert_path.write_text(cert)
        result = run_odoo(ODOO_SCRIPT)
        lines = [line[len(MARKER):] for line in result.stdout.splitlines() if line.startswith(MARKER)]
        if len(lines) != 1:
            raise RuntimeError("Odoo did not return a credential; review account/key state before retrying")
        credentials = json.loads(lines[0])
        secret = {"apiVersion": "v1", "kind": "Secret", "metadata": {"name": "medusa-odoo", "namespace": "medusa"},
                  "type": "Opaque", "data": {name: base64.b64encode(value.encode()).decode()
                                             for name, value in credentials.items()}}
        sealed = json.loads(run([kubeseal, "--cert", str(cert_path), "--format", "json"],
                                input=json.dumps(secret), timeout=20).stdout)
        # Serialize only encrypted data as repository-style block YAML.
        encrypted = sealed['spec']['encryptedData']
        content = ["apiVersion: bitnami.com/v1alpha1", "kind: SealedSecret", "metadata:",
                   "  name: medusa-odoo", "  namespace: medusa", "  annotations:",
                   "    argocd.argoproj.io/sync-wave: '-2'", "spec:", "  encryptedData:"]
        content += [f"    {name}: {encrypted[name]}" for name in sorted(encrypted)]
        content += ["  template:", "    metadata:", "      name: medusa-odoo", "      namespace: medusa", "    type: Opaque", ""]
        with OUTPUT.open('x') as handle:
            handle.write('\n'.join(content))
    print(f"Created read-only Odoo account medusa-integration and wrote {OUTPUT}. No resources applied; sync remains disabled.")
    report_pending(result)


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        # Never print subprocess stdout/stderr: it may contain the generated key.
        print(f"Provisioning stopped ({type(error).__name__}). No credential output was displayed.", file=sys.stderr)
        if isinstance(error, RuntimeError):
            print(str(error), file=sys.stderr)
        print("If account creation had started, inspect its API-key list before retrying; do not rotate blindly.", file=sys.stderr)
        sys.exit(1)
