#!/usr/bin/env python3
"""Read-only readiness gate; never treats replica counts as proof of HA."""
import argparse
import json
import subprocess
import sys


def assess(nodes, pods, workloads):
    problems = []
    workers = []
    for node in nodes:
        name = node['metadata']['name']
        conditions = {c['type']: c['status'] for c in node['status'].get('conditions', [])}
        if conditions.get('Ready') != 'True':
            problems.append(f'{name}: NotReady')
        if node.get('spec', {}).get('unschedulable'):
            problems.append(f'{name}: cordoned')
        for pressure in ('DiskPressure', 'MemoryPressure', 'PIDPressure'):
            if conditions.get(pressure) == 'True':
                problems.append(f'{name}: {pressure}')
        if 'node-role.kubernetes.io/control-plane' not in node['metadata'].get('labels', {}):
            workers.append(name)
    if len(workers) < 3:
        problems.append('Fewer than three worker failure domains; three-voter services need independent placement')
    quorum_nodes = {n['metadata']['name'] for n in nodes
                    if any(t.get('key') == 'quorum' for t in n.get('spec', {}).get('taints', []))}
    general_roles = ('authentik-server-', 'authentik-worker-', 'argocd-server-',
                     'argocd-repo-server-', 'argocd-application-controller-',
                     'argocd-redis-ha-haproxy-', 'cnpg-operator-',
                     'nextcloud-redis-haproxy-', 'renovate-')
    for pod in pods:
        if (pod.get('spec', {}).get('nodeName') in quorum_nodes
                and pod['metadata']['name'].startswith(general_roles)
                and pod.get('status', {}).get('phase') not in ('Succeeded', 'Failed')):
            problems.append(f"{pod['metadata']['namespace']}/{pod['metadata']['name']}: general workload on reserved quorum node")
    for obj in workloads:
        desired = obj['spec'].get('replicas', 1)
        ready = obj.get('status', {}).get('readyReplicas', 0)
        name = obj['metadata']['namespace'] + '/' + obj['metadata']['name']
        if ready < desired:
            problems.append(f'{name}: {ready}/{desired} ready')
        selector = obj['spec'].get('selector', {}).get('matchLabels', {})
        members = [p for p in pods if p['metadata']['namespace'] == obj['metadata']['namespace']
                   and selector and all(p['metadata'].get('labels', {}).get(k) == v for k, v in selector.items())
                   and not p['metadata'].get('deletionTimestamp')
                   and any(c['type'] == 'Ready' and c['status'] == 'True' for c in p.get('status', {}).get('conditions', []))]
        hosts = {p.get('spec', {}).get('nodeName') for p in members} - {None}
        if desired > 1 and len(hosts) < 2:
            problems.append(f'{name}: ready replicas occupy fewer than two nodes')
    return problems



def assess_databases(clusters):
    problems = []
    for cluster in clusters:
        name = cluster['metadata']['namespace'] + '/' + cluster['metadata']['name']
        status = cluster.get('status', {})
        desired = cluster['spec'].get('instances', 1)
        ready = status.get('readyInstances', 0)
        if ready < desired:
            problems.append(f'{name}: PostgreSQL has {ready}/{desired} ready instances')
        if not status.get('currentPrimary') or status.get('targetPrimary') != status.get('currentPrimary'):
            problems.append(f'{name}: PostgreSQL primary transition is incomplete')
    return problems


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--kubectl', default='/home/linuxbrew/.linuxbrew/bin/kubectl')
    parser.add_argument('--kubeconfig', default='kubeconfig')
    args = parser.parse_args()

    def get(resource, all_namespaces=False):
        cmd = [args.kubectl, '--kubeconfig', args.kubeconfig, 'get', resource]
        if all_namespaces:
            cmd.append('-A')
        return json.loads(subprocess.check_output(cmd + ['-o', 'json'], timeout=60))['items']

    problems = assess(get('nodes'), get('pods', True), get('deployments,statefulsets', True))
    problems.extend(assess_databases(get('clusters.postgresql.cnpg.io', True)))
    for problem in problems:
        print('BLOCK:', problem)
    print('This gate checks current nodes, controller/database replica readiness and placement.')
    print('Also verify N-1 CPU/memory/pod/disk capacity, data quorum, storage, routing, and authenticated transactions.')
    if problems:
        print('Do not begin another node-loss drill while these blockers remain.')
    return bool(problems)


if __name__ == '__main__':
    sys.exit(main())
