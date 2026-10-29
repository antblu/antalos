import os
from pathlib import Path
import re
import signal
import subprocess
import tempfile
import time
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[2]


class RedisRejoin(unittest.TestCase):
    def test_discovery_rejects_one_voter_and_follows_two(self):
        variables = yaml.safe_load((ROOT / 'apps/variables.yaml').read_text())['variables']
        for namespace in ['cal-diy', 'forgejo', 'litellm', 'mautic', 'medusa', 'invoiceninja']:
            folder = ROOT / 'apps' / namespace
            if namespace == 'invoiceninja':
                folder /= 'manifests'
            config = next(d for d in yaml.safe_load_all((folder / 'redis.yaml').read_text()) if d and d['kind'] == 'ConfigMap')
            script = re.sub(r'\$\{([A-Z_0-9]+)\}', lambda match: str(variables[match[1]]), config['data']['discover-master.sh'])
            with self.subTest(namespace=namespace), tempfile.TemporaryDirectory() as directory:
                path = Path(directory)
                (path / 'redis-cli').write_text('''#!/bin/sh
while [ "$#" -gt 0 ]; do
  if [ "$1" = -h ]; then shift; host=$1; fi
  shift
done
case "$host" in
  *data-0*) printf 'stale-primary\\n6379\\n';;
  *) [ "$ONE_VOTER" = 0 ] || exit 1; printf 'elected-primary\\n6379\\n';;
esac
''')
                (path / 'redis-cli').chmod(0o755)
                environment = dict(os.environ, PATH=directory + ':' + os.environ['PATH'], REDIS_PASSWORD='fixture-only')
                one = subprocess.run(['sh', '-c', script], env=dict(environment, ONE_VOTER='1'), capture_output=True, text=True, timeout=5)
                self.assertNotEqual(one.returncode, 0)
                two = subprocess.run(['sh', '-c', script], env=dict(environment, ONE_VOTER='0'), capture_output=True, text=True, timeout=5)
                self.assertEqual(two.returncode, 0, two.stderr)
                self.assertEqual(two.stdout.strip(), 'elected-primary 6379')

    def test_nextcloud_former_writer_rejoins_quorum_primary(self):
        config = next(d for d in yaml.safe_load_all((ROOT / 'apps/nextcloud/redis.yaml').read_text()) if d and d['kind'] == 'ConfigMap')
        data = next(d for d in yaml.safe_load_all((ROOT / 'apps/nextcloud/redis.yaml').read_text()) if d and d['kind'] == 'StatefulSet')
        self.assertEqual(data['spec']['template']['metadata']['annotations']['antalos.dev/redis-rejoin'], 'sentinel-quorum-v1')
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path / 'redis.conf').write_text('appendonly yes\nreplica-announce-ip obsolete\n')
            (path / 'redis-cli').write_text("#!/bin/sh\nprintf 'nextcloud-redis-data-1.nextcloud-redis-data.nextcloud.svc.cluster.local\\n6379\\n'\n")
            (path / 'getent').write_text('#!/bin/sh\nexit 1\n')
            (path / 'redis-server').write_text('#!/bin/sh\ncat "$1"\n')
            for name in ['redis-cli', 'getent', 'redis-server']:
                (path / name).chmod(0o755)
            script = config['data']['start-redis.sh'].replace('/data/', directory + '/')
            result = subprocess.run(['sh', '-c', script], env=dict(os.environ, PATH=directory + ':' + os.environ['PATH'], HOSTNAME='nextcloud-redis-data-0', REDIS_PASSWORD='fixture-only'), capture_output=True, text=True, timeout=5)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('replicaof nextcloud-redis-data-1.nextcloud-redis-data.nextcloud.svc.cluster.local 6379', result.stdout)
            self.assertIn('replica-announce-ip nextcloud-redis-data-0.nextcloud-redis-data.nextcloud.svc.cluster.local', result.stdout)
            self.assertNotIn('obsolete', result.stdout)

    def test_nextcloud_does_not_start_without_two_votes(self):
        config = next(d for d in yaml.safe_load_all((ROOT / 'apps/nextcloud/redis.yaml').read_text()) if d and d['kind'] == 'ConfigMap')
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path / 'redis.conf').write_text('appendonly yes\n')
            (path / 'redis-cli').write_text('#!/bin/sh\nexit 1\n')
            (path / 'redis-server').write_text('#!/bin/sh\ntouch "$STARTED"\n')
            for name in ['redis-cli', 'redis-server']:
                (path / name).chmod(0o755)
            script = config['data']['start-redis.sh'].replace('/data/', directory + '/').replace('sleep 2', 'sleep 0.05')
            process = subprocess.Popen(['sh', '-c', script], env=dict(os.environ, PATH=directory + ':' + os.environ['PATH'], HOSTNAME='nextcloud-redis-data-0', REDIS_PASSWORD='fixture-only', STARTED=str(path / 'started')), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
            try:
                time.sleep(0.2)
                self.assertIsNone(process.poll())
                self.assertFalse((path / 'started').exists())
            finally:
                os.killpg(process.pid, signal.SIGTERM)
                process.wait(timeout=3)
