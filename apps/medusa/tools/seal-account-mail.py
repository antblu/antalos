#!/usr/bin/env python3
"""Seal an existing SMTP application password without logging or changing it."""
import argparse
import base64
import getpass
import json
import shutil
import sys
import subprocess
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--password-stdin', action='store_true', help='Read a credential from a private process pipe')
    parser.add_argument('--password-file', type=Path, help='Protected local file; otherwise use a hidden prompt')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    target = root / 'apps/medusa/account-mail-secret.yaml'
    if target.exists():
        raise RuntimeError('Refusing to overwrite an existing sealed credential; review rotation explicitly')
    kubeseal = shutil.which('kubeseal') or '/home/linuxbrew/.linuxbrew/bin/kubeseal'
    # Check controller access before reading the credential.
    controller = [kubeseal, '--kubeconfig', str(root / 'kubeconfig'), '--controller-name', 'sealed-secrets-controller', '--controller-namespace', 'sealed-secrets']
    subprocess.run(controller + ['--fetch-cert'], check=True, capture_output=True)
    password = sys.stdin.read().rstrip('\r\n') if args.password_stdin else args.password_file.read_text().rstrip('\r\n') if args.password_file else getpass.getpass('Stalwart SMTP application password: ')
    if not password or '\n' in password or '\r' in password:
        raise RuntimeError('A nonempty single-line application password is required')
    secret = {'apiVersion': 'v1', 'kind': 'Secret', 'metadata': {'name': 'medusa-account-mail', 'namespace': 'medusa', 'annotations': {'argocd.argoproj.io/sync-wave': '-2'}}, 'type': 'Opaque', 'data': {'ACCOUNT_SMTP_PASSWORD': base64.b64encode(password.encode()).decode()}}
    # Plaintext Secret remains in a pipe; only ciphertext is written to disk.
    sealed = subprocess.run(controller + ['--format', 'yaml'], input=json.dumps(secret).encode(), capture_output=True, check=True).stdout
    if b'kind: SealedSecret' not in sealed:
        raise RuntimeError('Controller did not return a SealedSecret')
    with target.open('xb') as handle:
        handle.write(sealed)
    print('Sealed SMTP credential written. No mailbox credentials were created or rotated.')


if __name__ == '__main__':
    main()
