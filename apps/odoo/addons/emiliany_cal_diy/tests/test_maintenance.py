import importlib.util
import sys
import types
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

path = Path(__file__).parents[1] / 'maintenance' / 'install.py'
with patch.dict(sys.modules, {'psycopg2': types.ModuleType('psycopg2'), 's3fs': types.ModuleType('s3fs')}):
    spec = importlib.util.spec_from_file_location('cal_maintenance', path)
    maintenance = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(maintenance)


class MaintenanceTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 5, 12, tzinfo=timezone.utc)
        self.start = self.now - timedelta(minutes=30)
        self.manifest = {'database': 'odoo', 'database_dump': 'database.dump',
                         'layout': 'ha-postgresql-sessions-s3-attachments-v1',
                         'completed_at': (self.now - timedelta(minutes=5)).isoformat()}
        self.app = {'spec': {'syncPolicy': {}}, 'status': {}}
        self.scale = {'spec': {'replicas': 0}, 'status': {'replicas': 0}}
        self.pods = {'items': []}

    def test_valid_backup_and_paused_cluster(self):
        maintenance.check_backup_manifest(self.manifest, 'odoo', self.start, self.now)
        maintenance.check_maintenance(self.app, self.scale, self.pods)
        maintenance.check_maintenance(self.app, {'spec': {}, 'status': {'replicas': 0}}, self.pods)

    def test_backup_before_maintenance_rejected(self):
        self.manifest['completed_at'] = (self.start - timedelta(seconds=1)).isoformat()
        with self.assertRaises(RuntimeError):
            maintenance.check_backup_manifest(self.manifest, 'odoo', self.start, self.now)

    def test_mismatched_or_stale_backup_rejected(self):
        with self.assertRaises(RuntimeError):
            maintenance.check_backup_manifest(self.manifest, 'other', self.start, self.now)
        self.manifest['completed_at'] = (self.now - timedelta(hours=3)).isoformat()
        with self.assertRaises(RuntimeError):
            maintenance.check_backup_manifest(self.manifest, 'odoo', self.now - timedelta(hours=4), self.now)

    def test_active_sync_or_pods_rejected(self):
        with self.assertRaises(RuntimeError):
            maintenance.check_maintenance({'spec': {'syncPolicy': {'automated': {}}}}, self.scale, self.pods)
        with self.assertRaises(RuntimeError):
            maintenance.check_maintenance(self.app, {'spec': {'replicas': 1}}, self.pods)
        with self.assertRaises(RuntimeError):
            maintenance.check_maintenance(self.app, {'spec': {}, 'status': {'replicas': 1}}, self.pods)
        with self.assertRaises(RuntimeError):
            maintenance.check_maintenance(self.app, {}, self.pods)
        with self.assertRaises(RuntimeError):
            maintenance.check_maintenance(self.app, self.scale, {})
        with self.assertRaises(RuntimeError):
            maintenance.check_maintenance({'operation': {'sync': {}}}, self.scale, self.pods)
        with self.assertRaises(RuntimeError):
            maintenance.check_maintenance(self.app, self.scale, {'items': [{}]})
        with self.assertRaises(RuntimeError):
            maintenance.check_maintenance({'status': {'operationState': {'phase': 'Running'}}}, self.scale, self.pods)

    def test_invalid_timestamp_rejected(self):
        with self.assertRaises(RuntimeError):
            maintenance.timestamp('2026-11-05T12:00:00')


if __name__ == '__main__':
    unittest.main()
