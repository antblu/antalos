"""Manual, maintenance-only Odoo addon installer. Never run against serving pods."""
import ast
import configparser
import json
import os
import re
import ssl
import subprocess
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg2
import s3fs


def timestamp(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise RuntimeError('Maintenance timestamps must include a timezone')
    return result.astimezone(timezone.utc)


def check_backup_manifest(manifest, database, maintenance_start, now):
    if manifest.get('database') != database or manifest.get('database_dump') != 'database.dump':
        raise RuntimeError('Backup manifest does not match the database')
    if manifest.get('layout') != 'ha-postgresql-sessions-s3-attachments-v1':
        raise RuntimeError('Unsupported Odoo backup layout')
    completed = timestamp(manifest.get('completed_at', ''))
    if maintenance_start > completed or completed > now or now - completed > timedelta(hours=2):
        raise RuntimeError('Backup must complete during this maintenance window and be less than two hours old')


def check_maintenance(application, scale, pods):
    automated = application.get('spec', {}).get('syncPolicy', {}).get('automated')
    if automated is not None and automated.get('enabled') is not False:
        raise RuntimeError('Suspend Argo CD automated sync before installing')
    operation = (application.get('status', {}).get('operationState') or {}).get('phase')
    if application.get('operation') or operation in ('Running', 'Terminating'):
        raise RuntimeError('An Argo CD operation is still running')
    # The Scale API omits spec.replicas when it is zero (omitempty).
    if (not isinstance(scale.get('spec'), dict) or not isinstance(scale.get('status'), dict)
            or scale['spec'].get('replicas', 0) != 0 or scale['status'].get('replicas') != 0
            or not isinstance(pods.get('items'), list) or pods['items']):
        raise RuntimeError('Stop the Odoo deployment and wait for every serving pod to terminate')


def main():
    backup_id = os.environ.get('ODOO_CAL_DIY_BACKUP_ID', '')
    if not re.fullmatch(r'\d{8}T\d{6}Z', backup_id):
        raise RuntimeError('A completed backup ID is required')
    start = timestamp(os.environ.get('ODOO_CAL_DIY_MAINTENANCE_START', ''))
    account = Path('/var/run/secrets/kubernetes.io/serviceaccount')
    base = 'https://' + os.environ['KUBERNETES_SERVICE_HOST'] + ':' + os.environ['KUBERNETES_SERVICE_PORT_HTTPS']
    headers = {'Authorization': 'Bearer ' + (account / 'token').read_text()}
    context = ssl.create_default_context(cafile=str(account / 'ca.crt'))

    def get(path):
        req = urllib.request.Request(base + path, headers=headers)
        with urllib.request.urlopen(req, context=context, timeout=20) as response:
            return json.load(response)

    def check_cluster():
        check_maintenance(
            get('/apis/argoproj.io/v1alpha1/namespaces/argocd/applications/odoo'),
            get('/apis/apps/v1/namespaces/odoo/deployments/odoo/scale'),
            get('/api/v1/namespaces/odoo/pods?labelSelector=app.kubernetes.io%2Fname%3Dodoo'),
        )

    check_cluster()
    fs = s3fs.S3FileSystem(
        key=os.environ['AWS_ACCESS_KEY_ID'], secret=os.environ['AWS_SECRET_ACCESS_KEY'],
        endpoint_url=os.environ['ODOO_S3_ENDPOINT'], client_kwargs={'region_name': os.environ['AWS_DEFAULT_REGION']},
        config_kwargs={'s3': {'addressing_style': 'path'}, 'request_checksum_calculation': 'when_required',
                       'response_checksum_validation': 'when_required'},
    )
    root = os.environ['ODOO_S3_BUCKET'] + '/' + os.environ['ODOO_S3_BACKUP_PREFIX'].strip('/') + '/' + backup_id
    with fs.open(root + '/COMPLETE.json') as source:
        manifest = json.load(source)
    check_backup_manifest(manifest, os.environ['SESSION_DB_URI'], start, datetime.now(timezone.utc))
    if fs.size(root + '/database.dump') <= 0:
        raise RuntimeError('Backup database dump is empty')
    config = configparser.RawConfigParser()
    config.read('/config/odoo.conf')
    config['options']['db_password'] = Path('/credentials/database/password').read_text()
    config['options']['admin_passwd'] = Path('/credentials/app/master-password').read_text()
    os.umask(0o077)
    with open('/run/odoo/odoo.conf', 'w') as destination:
        config.write(destination)
    with psycopg2.connect(host=config['options']['db_host'], dbname=os.environ['SESSION_DB_URI'],
                          user=config['options']['db_user'], password=config['options']['db_password'],
                          sslmode='require', connect_timeout=10) as connection:
        connection.autocommit = True
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_advisory_lock(19650621)')
            check_cluster()
            cursor.execute("SELECT state FROM ir_module_module WHERE name = 'emiliany_cal_diy'")
            installed = cursor.fetchone()
            command = '--update=emiliany_cal_diy' if installed and installed[0] == 'installed' else '--init=emiliany_cal_diy'
            subprocess.run(['odoo', '--config=/run/odoo/odoo.conf', command, '--without-demo=true',
                            '--stop-after-init', '--no-http'], check=True)
            cursor.execute("SELECT state, latest_version FROM ir_module_module WHERE name = 'emiliany_cal_diy'")
            version = ast.literal_eval(Path('/mnt/extra-addons/emiliany_cal_diy/__manifest__.py').read_text())['version']
            if cursor.fetchone() != ('installed', version):
                raise RuntimeError('Addon installation did not reach the required version')
    print('Addon installation completed; keep serving stopped until rollout is deliberately resumed', flush=True)


if __name__ == '__main__':
    main()
