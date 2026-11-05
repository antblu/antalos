"""Render the snapshot worker source into its GitOps ConfigMap."""
from pathlib import Path
import yaml

root = Path(__file__).resolve().parent
resource = {'apiVersion': 'v1', 'kind': 'ConfigMap',
            'metadata': {'name': 'cal-diy-odoo-snapshot', 'namespace': 'cal-diy'},
            'data': {'snapshot.py': (root / 'snapshot.py').read_text()}}
class Dumper(yaml.SafeDumper):
    pass
def represent(dumper, value):
    return dumper.represent_scalar('tag:yaml.org,2002:str', value, style='|' if '\n' in value else None)
Dumper.add_representer(str, represent)
(root.parent / 'odoo-snapshot-config.yaml').write_text(yaml.dump(resource, Dumper=Dumper, sort_keys=False))
