import importlib.util
from pathlib import Path
import os
import json
import subprocess
import tempfile
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('failover', ROOT / 'tools/check-node-failover.py')
failover = importlib.util.module_from_spec(spec)
spec.loader.exec_module(failover)


class RedisRejoin(unittest.TestCase):
    def test_restart_and_migration(self):
        for app in ('stalwart', 'open-webui', 'zammad'):
            with self.subTest(app=app), tempfile.TemporaryDirectory() as tmp:
                work = Path(tmp)
                data = work / 'data'
                data.mkdir()
                cm = next(yaml.safe_load_all((ROOT / f'apps/{app}/redis.yaml').read_text()))
                script = cm['data']['start-redis.sh'].replace('/data', str(data)).replace('/config/discover-master.sh', str(work / 'discover'))
                (work / 'start').write_text(script)
                (work / 'discover').write_text('#!/bin/sh\n[ -n "$TEST_MASTER" ] || exit 1\nprintf "%s\\n" "$TEST_MASTER"\n')
                (work / 'redis-server').write_text('#!/bin/sh\ncat "$1"\n')
                for name in ('discover', 'redis-server'):
                    (work / name).chmod(0o755)
                base = 'redis' if app == 'stalwart' else app + '-redis-data'
                dns = f'{base}-1.{base}.{app}.svc.cluster.local'
                env = dict(os.environ, PATH=tmp + ':' + os.environ['PATH'], HOSTNAME=base + '-0', REDIS_PASSWORD='test-only', TEST_MASTER=dns + ' 6379')
                # A former ordinal-zero writer must follow the promoted ordinal-one member.
                result = subprocess.run(['sh', str(work / 'start')], env=env, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn('replicaof ' + dns + ' 6379', result.stdout)
                # An already promoted member must not reintroduce its old replica role.
                env['HOSTNAME'] = base + '-1'
                result = subprocess.run(['sh', str(work / 'start')], env=env, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertNotIn('replicaof ', result.stdout)
                # With an existing dataset, do not restart from a stale role without voters.
                (data / 'appendonlydir').mkdir()
                env['TEST_MASTER'] = ''
                result = subprocess.run(['sh', str(work / 'start')], env=env, capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('agreement from two Sentinels', result.stderr)
                # First migration of existing data must fail closed without a voter.
                (data / 'redis.conf').unlink()
                result = subprocess.run(['sh', str(work / 'start')], env=env, capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('agreement from two Sentinels', result.stderr)
                self.assertFalse((data / 'redis.conf').exists())

    def test_discovery_requires_voter_agreement(self):
        for app in ('stalwart', 'open-webui', 'zammad'):
            with self.subTest(app=app), tempfile.TemporaryDirectory() as tmp:
                work = Path(tmp)
                cm = next(yaml.safe_load_all((ROOT / f'apps/{app}/redis.yaml').read_text()))
                script = cm['data']['discover-master.sh']
                (work / 'discover').write_text(script)
                (work / 'redis-cli').write_text('#!/usr/bin/python3\nimport os,sys,json\nhost=sys.argv[sys.argv.index("-h")+1]\nreply=json.loads(os.environ["TEST_REPLIES"]).get(host)\nif reply is None: sys.exit(1)\nprint(reply)\n')
                (work / 'redis-cli').chmod(0o755)
                peers = script.split('for peer in ', 1)[1].split(';', 1)[0].split()
                replies = {peers[0]: 'old-primary\n6379', peers[1]: 'new-primary\n6379', peers[2]: 'new-primary\n6379'}
                env = dict(os.environ, PATH=tmp + ':' + os.environ['PATH'], REDIS_PASSWORD='test-only', TEST_REPLIES=json.dumps(replies))
                result = subprocess.run(['sh', str(work / 'discover')], env=env, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout.strip(), 'new-primary 6379')
                env['TEST_REPLIES'] = json.dumps({peers[0]: 'old-primary\n6379'})
                result = subprocess.run(['sh', str(work / 'discover')], env=env, capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(result.stdout, '')

    def test_sentinel_data_and_quorum_paths(self):
        for app in ('stalwart', 'open-webui', 'zammad'):
            for quorum in (False, True):
                with self.subTest(app=app, quorum=quorum), tempfile.TemporaryDirectory() as tmp:
                    work = Path(tmp)
                    cm = next(yaml.safe_load_all((ROOT / f'apps/{app}/redis.yaml').read_text()))
                    data_config = work / 'persistent.conf'
                    quorum_config = work / 'temporary.conf'
                    script = cm['data']['start-sentinel.sh'].replace('/sentinel/sentinel.conf', str(data_config)).replace('/tmp/sentinel.conf', str(quorum_config)).replace('/config/discover-master.sh', str(work / 'discover'))
                    (work / 'start').write_text(script)
                    (work / 'discover').write_text('#!/bin/sh\necho "new-primary 6379"\n')
                    (work / 'redis-sentinel').write_text('#!/bin/sh\ncat "$1"\n')
                    for name in ('discover', 'redis-sentinel'):
                        (work / name).chmod(0o755)
                    base = 'redis' if app == 'stalwart' else app + '-redis-data'
                    hostname = ('redis-quorum-abc-123' if app == 'stalwart' else app + '-redis-quorum-abc-123') if quorum else base + '-0'
                    env = dict(os.environ, PATH=tmp + ':' + os.environ['PATH'], HOSTNAME=hostname, REDIS_PASSWORD='test-only')
                    result = subprocess.run(['sh', str(work / 'start')], env=env, capture_output=True, text=True)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertEqual(data_config.exists(), not quorum)
                    self.assertEqual(quorum_config.exists(), quorum)
                    self.assertIn('sentinel monitor ' + app + ' new-primary 6379 2', result.stdout)
                    chosen = quorum_config if quorum else data_config
                    chosen.write_text('persisted-topology\n')
                    result = subprocess.run(['sh', str(work / 'start')], env=env, capture_output=True, text=True)
                    self.assertEqual(result.stdout, 'persisted-topology\n')

    def test_scripts_parse(self):
        for app in ('stalwart', 'open-webui', 'zammad'):
            cm = next(yaml.safe_load_all((ROOT / f'apps/{app}/redis.yaml').read_text()))
            for key, script in cm['data'].items():
                if key.endswith('.sh'):
                    result = subprocess.run(['sh', '-n'], input=script, text=True, capture_output=True)
                    self.assertEqual(result.returncode, 0, f'{app}/{key}: {result.stderr}')


class DatabaseReadinessGate(unittest.TestCase):
    def test_recovered_node_does_not_hide_missing_database_standby(self):
        cluster = {'metadata': {'namespace': 'test', 'name': 'db'}, 'spec': {'instances': 2},
                   'status': {'readyInstances': 1, 'currentPrimary': 'db-2', 'targetPrimary': 'db-2'}}
        self.assertEqual(failover.assess_databases([cluster]), ['test/db: PostgreSQL has 1/2 ready instances'])

    def test_primary_transition_blocks_next_failure(self):
        cluster = {'metadata': {'namespace': 'test', 'name': 'db'}, 'spec': {'instances': 2},
                   'status': {'readyInstances': 2, 'currentPrimary': 'db-1', 'targetPrimary': 'db-2'}}
        self.assertIn('test/db: PostgreSQL primary transition is incomplete', failover.assess_databases([cluster]))


class ReadinessGate(unittest.TestCase):
    def test_ready_identity_pod_on_quorum_worker_blocks_failure_drill(self):
        node = {'metadata': {'name': 'quorum-worker'}, 'spec': {'taints': [{'key': 'quorum', 'effect': 'NoSchedule'}]},
                'status': {'conditions': [{'type': 'Ready', 'status': 'True'}]}}
        pod = {'metadata': {'namespace': 'authentik', 'name': 'authentik-server-example'},
               'spec': {'nodeName': 'quorum-worker'}, 'status': {'phase': 'Running'}}
        self.assertIn('authentik/authentik-server-example: general workload on reserved quorum node', failover.assess([node], [pod], []))

    def test_detects_cordon_pressure_and_lost_worker(self):
        nodes = [{'metadata': {'name': 'worker-' + str(i)}, 'spec': {'unschedulable': i == 0},
                  'status': {'conditions': [{'type': 'Ready', 'status': 'False' if i == 1 else 'True'},
                                             {'type': 'DiskPressure', 'status': 'True' if i == 2 else 'False'}]}}
                 for i in range(3)]
        problems = failover.assess(nodes, [], [])
        self.assertIn('worker-0: cordoned', problems)
        self.assertIn('worker-1: NotReady', problems)
        self.assertIn('worker-2: DiskPressure', problems)

    def test_replicas_on_same_node_are_not_redundancy(self):
        workload = {'metadata': {'name': 'web', 'namespace': 'test'}, 'spec': {'replicas': 2, 'selector': {'matchLabels': {'app': 'web'}}}, 'status': {'readyReplicas': 2}}
        pod = {'metadata': {'namespace': 'test', 'labels': {'app': 'web'}}, 'spec': {'nodeName': 'worker'}, 'status': {'conditions': [{'type': 'Ready', 'status': 'True'}]}}
        self.assertIn('test/web: ready replicas occupy fewer than two nodes', failover.assess([], [pod, pod], [workload]))


if __name__ == '__main__':
    unittest.main()
