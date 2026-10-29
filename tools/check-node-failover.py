#!/usr/bin/env python3
"""Read-only readiness gate; never treats replica counts as proof of HA."""
import argparse
import json
import re
from decimal import Decimal
import subprocess
import sys
import urllib.request


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



def memory_bytes(value):
    match = re.fullmatch(r'([0-9.]+)([KMGTPE]i|[kKMGTPE]|m)?', str(value))
    if not match:
        raise ValueError('Unsupported Kubernetes memory quantity: ' + str(value))
    number, suffix = match.groups()
    factors = {'': 1, 'm': Decimal('0.001'), 'k': 1000}
    for index, unit in enumerate('KMGTPE', 1):
        factors[unit] = 1000 ** index
        factors[unit + 'i'] = 1024 ** index
    return Decimal(number) * factors[suffix or '']


def pod_memory_request(spec):
    def request(container):
        return memory_bytes(container.get('resources', {}).get('requests', {}).get('memory', '0'))
    running = sum((request(c) for c in spec.get('containers', [])), Decimal(0))
    sidecars = Decimal(0)
    init_peak = Decimal(0)
    for container in spec.get('initContainers', []):
        if container.get('restartPolicy') == 'Always':
            sidecars += request(container)
            init_peak = max(init_peak, sidecars)
        else:
            init_peak = max(init_peak, sidecars + request(container))
    return max(running + sidecars, init_peak) + memory_bytes(spec.get('overhead', {}).get('memory', '0'))


def assess_recovery_capacity(nodes, pods, workloads):
    # These two disposable singleton Deployments must replace the lost process.
    replacements = {('nextcloud', 'nextcloud-talk'), ('suitecrm', 'suitecrm-messenger')}
    general = [n for n in nodes if not any(t.get('effect') in ('NoSchedule', 'NoExecute')
               for t in n.get('spec', {}).get('taints', []))
               and 'node-role.kubernetes.io/control-plane' not in n['metadata'].get('labels', {})]
    if len(general) != 2:
        return ['Recovery capacity requires two eligible general workers; reserved nodes cannot supply overflow']
    requests = {n['metadata']['name']: Decimal(0) for n in general}
    active = [p for p in pods if p.get('status', {}).get('phase') not in ('Succeeded', 'Failed')]
    for pod in active:
        host = pod.get('spec', {}).get('nodeName')
        if host in requests:
            requests[host] += pod_memory_request(pod['spec'])
    problems = []
    for target in general:
        host = target['metadata']['name']
        needed = Decimal(0)
        for workload in workloads:
            identity = (workload['metadata']['namespace'], workload['metadata']['name'])
            if identity not in replacements:
                continue
            selector = workload['spec']['selector']['matchLabels']
            members = [p for p in active if p['metadata']['namespace'] == identity[0]
                       and not p['metadata'].get('deletionTimestamp')
                       and all(p['metadata'].get('labels', {}).get(k) == v for k, v in selector.items())]
            if any(p.get('spec', {}).get('nodeName') != host for p in members):
                needed += pod_memory_request(workload['spec']['template']['spec'])
        free = memory_bytes(target['status']['allocatable']['memory']) - requests[host]
        if free < needed:
            problems.append(f'{host}: replacement singleton recovery needs {needed / 2**20:.0f}Mi; only {free / 2**20:.0f}Mi unreserved (RTX excluded)')
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


def assess_nextcloud(status):
    if not status.get('installed') or status.get('maintenance') or status.get('needsDbUpgrade'):
        return ['Nextcloud application is unavailable or requires maintenance/upgrade despite pod readiness']
    return []


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

    nodes, pods, workloads = get('nodes'), get('pods', True), get('deployments,statefulsets', True)
    problems = assess(nodes, pods, workloads)
    problems.extend(assess_recovery_capacity(nodes, pods, workloads))
    problems.extend(assess_databases(get('clusters.postgresql.cnpg.io', True)))
    # HTTP 200 from status.php is not enough: pending app migrations return 200.
    for ingress in get('ingresses', True):
        if ingress['metadata']['namespace'] == 'nextcloud' and ingress['metadata']['name'] == 'nextcloud':
            host = ingress['spec']['rules'][0]['host']
            try:
                with urllib.request.urlopen('https://' + host + '/status.php', timeout=10) as response:
                    problems.extend(assess_nextcloud(json.load(response)))
            except Exception as error:
                problems.append('Nextcloud application status probe failed: ' + type(error).__name__)

    for problem in problems:
        print('BLOCK:', problem)
    print('This gate checks current nodes, controller/database replica readiness and placement.')
    print('Also verify N-1 CPU/memory/pod/disk capacity, data quorum, storage, routing, and authenticated transactions.')
    if problems:
        print('Do not begin another node-loss drill while these blockers remain.')
    return bool(problems)


if __name__ == '__main__':
    sys.exit(main())
