"""Render the manual installer with declared shared inputs and maintenance facts."""
import argparse
import json
import re
from datetime import datetime
from pathlib import Path
import yaml

parser = argparse.ArgumentParser()
parser.add_argument('--backup-id', required=True)
parser.add_argument('--maintenance-start', required=True, help='ISO 8601 UTC time when all serving pods were stopped')
args = parser.parse_args()
if not re.fullmatch(r'\d{8}T\d{6}Z', args.backup_id):
    parser.error('invalid backup ID')
try:
    parsed = datetime.fromisoformat(args.maintenance_start.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError()
except ValueError:
    parser.error('maintenance start must include a timezone')
root = Path(__file__).resolve().parents[3]
variables = yaml.safe_load((root / 'apps/variables.yaml').read_text())['variables']
template = (Path(__file__).parent / 'install.yaml.example').read_text()

def replace(match):
    name = match.group(1)
    if name not in variables:
        raise ValueError('Undeclared shared input: ' + name)
    value = str(variables[name])
    if not re.fullmatch(r'[A-Za-z0-9_.:/-]+', value):
        raise ValueError('Unsafe shared input for this template: ' + name)
    return value

template = re.sub(r'\$\{([A-Z0-9_]+)\}', replace, template)
template = template.replace('__BACKUP_ID__', json.dumps(args.backup_id)).replace('__MAINTENANCE_START__', json.dumps(args.maintenance_start))
list(yaml.safe_load_all(template))
print(template, end='')
