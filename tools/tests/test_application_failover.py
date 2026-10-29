import json
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import time
import signal
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[2]


class ApplicationRecovery(unittest.TestCase):
    def test_renovate_yields_capacity_to_application_recovery(self):
        priority=yaml.safe_load((ROOT/'apps/renovate/priority-class.yaml').read_text())
        cron=yaml.safe_load((ROOT/'apps/renovate/cronjob.yaml').read_text())
        self.assertLess(priority['value'],0)
        self.assertFalse(priority['globalDefault'])
        self.assertEqual(priority['preemptionPolicy'],'Never')
        self.assertEqual(cron['spec']['jobTemplate']['spec']['template']['spec']['priorityClassName'],priority['metadata']['name'])

    def test_recovery_capacity_excludes_rtx_and_accounts_for_init_peak(self):
        spec=importlib.util.spec_from_file_location('gate',ROOT/'tools/check-node-failover.py')
        gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)
        def resources(memory):
            return {'resources': {'requests': {'memory': memory}}}
        nodes=[{'metadata':{'name':name},'spec':{'taints':taints},'status':{'allocatable':{'memory':'1Gi'}}}
               for name,taints in [('left',[]),('right',[]),('rtx',[{'key':'quorum','effect':'NoSchedule'}])]]
        pods=[{'metadata':{'namespace':'nextcloud','name':'talk','labels':{'app':'talk'}},
               'spec':{'nodeName':'left','containers':[resources('256Mi')]},'status':{'phase':'Running'}},
              {'metadata':{'namespace':'suitecrm','name':'messenger','labels':{'app':'messenger'}},
               'spec':{'nodeName':'left','containers':[resources('256Mi')]},'status':{'phase':'Running'}},
              {'metadata':{'namespace':'other','name':'busy'},'spec':{'nodeName':'right','containers':[resources('256Mi')],
               'initContainers':[resources('768Mi')]},'status':{'phase':'Running'}}]
        workloads=[{'metadata':{'namespace':ns,'name':name},'spec':{'selector':{'matchLabels':{'app':label}},
                    'template':{'spec':{'containers':[resources('256Mi')]}}}}
                   for ns,name,label in [('nextcloud','nextcloud-talk','talk'),('suitecrm','suitecrm-messenger','messenger')]]
        problems=gate.assess_recovery_capacity(nodes,pods,workloads)
        self.assertEqual(len(problems),1)
        self.assertIn('right:',problems[0]);self.assertIn('512Mi',problems[0]);self.assertIn('RTX excluded',problems[0])
        pods[-1]['spec']['initContainers'][0]=resources('384Mi')
        self.assertEqual(gate.assess_recovery_capacity(nodes,pods,workloads),[])
        batch={'metadata':{'namespace':'renovate','name':'batch'},'spec':{'nodeName':'right','containers':[resources('512Mi')]},'status':{'phase':'Running'}}
        pods.append(batch)
        self.assertTrue(gate.assess_recovery_capacity(nodes,pods,workloads))
        batch['spec'].update(priorityClassName='renovate-batch',priority=-1000)
        self.assertEqual(gate.assess_recovery_capacity(nodes,pods,workloads),[])

    def test_http_200_pending_migration_is_not_ready(self):
        spec=importlib.util.spec_from_file_location('gate',ROOT/'tools/check-node-failover.py')
        gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)
        self.assertTrue(gate.assess_nextcloud({'installed':True,'maintenance':False,'needsDbUpgrade':True}))
        self.assertFalse(gate.assess_nextcloud({'installed':True,'maintenance':False,'needsDbUpgrade':False}))

    def test_arbitrator_reconnects_when_seed_addresses_change(self):
        for service,folder in [('mautic','apps/mautic'),('suitecrm','apps/suitecrm'),('invoiceninja','apps/invoiceninja/manifests')]:
            with self.subTest(service=service), tempfile.TemporaryDirectory() as tmp:
                p=Path(tmp)
                script=yaml.safe_load((ROOT/folder/'galera-arbitrator.yaml').read_text())['data']['start.sh']
                script=script.replace('/tmp/garbd',str(p/'garbd')).replace('sleep 10','sleep 0.05')
                (p/'start').write_text(script)
                (p/'getent').write_text('#!/bin/sh\nn=$(cat "$TEST_COUNTER" 2>/dev/null || echo 0); n=$((n+1)); echo "$n" > "$TEST_COUNTER"; if [ "$n" -gt 2 ]; then echo "192.0.2.2 STREAM seed"; else echo "192.0.2.1 STREAM seed"; fi\n')
                (p/'garbd').write_text('#!/bin/sh\nwhile [ "$#" -gt 0 ]; do if [ "$1" = --log ]; then shift; log=$1; fi; shift; done\necho "view(view_id(PRIM,abc,1))" > "$log"\ntrap "exit 0" TERM INT\nwhile true; do sleep 0.1; done\n')
                (p/'mariadb').write_text('#!/bin/sh\nprintf "wsrep_cluster_status\\tPrimary\\nwsrep_ready\\tON\\nwsrep_connected\\tON\\nwsrep_local_state_comment\\tSynced\\nwsrep_cluster_size\\t2\\nwsrep_cluster_state_uuid\\ttest-uuid\\n"\n')
                for name in ['getent','garbd','mariadb']:(p/name).chmod(0o755)
                env=dict(os.environ,PATH=tmp+':'+os.environ['PATH'],SEEDS='seed',ADDRESS='gcomm://seed',ARBITRATOR_NAME='test',TEST_COUNTER=str(p/'counter'),HEALTH_USER='fixture',MYSQL_PWD='test-only')
                r=subprocess.run(['sh',str(p/'start')],env=env,capture_output=True,text=True,timeout=5)
                self.assertEqual(r.returncode,1,r.stderr)
                self.assertIn('seed addresses changed',r.stderr)

    def test_arbitrator_readiness_rejects_lost_primary_view(self):
        docs=list(yaml.safe_load_all((ROOT/'apps/mautic/database.yaml').read_text()))
        d=next(d for d in docs if d['kind']=='Deployment')
        probe=d['spec']['template']['spec']['containers'][0]['readinessProbe']['exec']['command'][-1]
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp);(p/'pid').write_text(str(os.getpid()))
            probe=probe.replace('/tmp/garbd.pid',str(p/'pid')).replace('/tmp/garbd.log',str(p/'log'))
            for text,expected in [('view(view_id(PRIM,abc,1))\n',0),('view(view_id(PRIM,abc,1))\nview(view_id(NON_PRIM,abc,2))\n',1),('view(view_id(PRIM,abc,1))\nview((empty))\n',1),('',1)]:
                (p/'log').write_text(text)
                self.assertEqual(subprocess.run(['sh','-ec',probe],capture_output=True).returncode,expected)

    def test_restart_retains_existing_shared_app_code(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp);apps=p/'apps';(apps/'contacts').mkdir(parents=True)
            (apps/'contacts'/'sentinel').write_text('existing code')
            script=yaml.safe_load((ROOT/'apps/nextcloud/config.yaml').read_text())['data']['install-apps.sh']
            # Exercise the actual installer function against a changed pin, without network.
            body=script[:script.index('    install_app announcementcenter') if '    install_app announcementcenter' in script else script.index('install_app announcementcenter')]
            body+='\ninstall_app contacts 99.0.0 https://invalid.example/not-requested\n'
            env=dict(os.environ,NEXTCLOUD_ALLOW_APP_UPDATES='0')
            r=subprocess.run(['sh','-c',body,'sh',str(apps)],env=env,capture_output=True,text=True,timeout=5)
            self.assertEqual(r.returncode,0,r.stderr)
            self.assertEqual((apps/'contacts'/'sentinel').read_text(),'existing code')
            self.assertIn('Retaining installed contacts',r.stdout)

    def test_consumer_retries_and_stops_without_starting_another_copy(self):
        cm=yaml.safe_load((ROOT/'apps/mautic/consumer-recovery.yaml').read_text())
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp);script=cm['data']['supervise.sh'].replace('/tmp/consumer.pid',str(p/'pid')).replace('sleep 5','sleep 0.05')
            (p/'supervise').write_text(script)
            (p/'consumer').write_text('#!/bin/sh\nn=$(cat "$TEST_COUNTER" 2>/dev/null || echo 0); n=$((n+1)); echo "$n" > "$TEST_COUNTER"; [ "$n" -gt 1 ] || exit 1\ntrap "exit 0" TERM INT\nwhile true; do sleep 0.05; done\n')
            (p/'consumer').chmod(0o755)
            process=subprocess.Popen(['sh',str(p/'supervise'),str(p/'consumer')],env=dict(os.environ,TEST_COUNTER=str(p/'count')),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
            try:
                deadline=time.monotonic()+3
                while time.monotonic()<deadline:
                    if (p/'count').exists() and (p/'count').read_text().strip()=='2':break
                    time.sleep(0.02)
                self.assertEqual((p/'count').read_text().strip(),'2')
                process.terminate();self.assertEqual(process.wait(timeout=3),0)
                self.assertEqual((p/'count').read_text().strip(),'2')
                self.assertFalse((p/'pid').exists())
            finally:
                if process.poll() is None:os.killpg(process.pid,signal.SIGKILL);process.wait()

    def test_arbitrator_does_not_refresh_without_healthy_data_members(self):
        script=yaml.safe_load((ROOT/'apps/mautic/galera-arbitrator.yaml').read_text())['data']['start.sh']
        functions=script[:script.index('initial=$(resolve_seeds)')]
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp);(p/'mariadb').write_text('#!/bin/sh\nprintf "wsrep_cluster_status\\tNon-Primary\\nwsrep_ready\\tOFF\\nwsrep_connected\\tON\\nwsrep_local_state_comment\\tSynced\\nwsrep_cluster_size\\t1\\nwsrep_cluster_state_uuid\\ttest-uuid\\n"\n');(p/'mariadb').chmod(0o755)
            env=dict(os.environ,PATH=tmp+':'+os.environ['PATH'],SEEDS='a b',HEALTH_USER='fixture')
            r=subprocess.run(['sh','-c',functions+'\ndata_members_healthy\n'],env=env,capture_output=True,text=True,timeout=5)
            self.assertNotEqual(r.returncode,0)

    def test_talk_deployment_has_stable_turn_routing(self):
        docs=list(yaml.safe_load_all((ROOT/'apps/nextcloud/talk.yaml').read_text()))
        workload=next(d for d in docs if d['metadata']['name']=='nextcloud-talk' and d['kind'] in ['Deployment','StatefulSet'])
        self.assertEqual(workload['kind'],'Deployment')
        self.assertEqual(workload['spec']['replicas'],1)
        self.assertEqual(workload['spec']['strategy']['type'],'Recreate')
        turn=next(d for d in docs if d['metadata']['name']=='nextcloud-talk-turn-0')
        labels=workload['spec']['template']['metadata']['labels']
        self.assertTrue(all(labels.get(k)==v for k,v in turn['spec']['selector'].items()))
        self.assertFalse(any(t.get('key')=='quorum' for t in workload['spec']['template']['spec']['tolerations']))


if __name__=='__main__':unittest.main()
