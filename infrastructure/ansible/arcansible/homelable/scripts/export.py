#!/usr/bin/env python3
"""Produce a non-secret import bundle using public handbook and live stable inventory.

Run from the repository root. OPNsense DNS export is optional. Never reads
kubeconfig contents, credentials, Secrets, pod inventories, or private VM inputs.
"""
import json,pathlib,subprocess,sys,re
repo=pathlib.Path.cwd();out=pathlib.Path(sys.argv[1]);dns_path=pathlib.Path(sys.argv[2]) if len(sys.argv)>2 else None
kubectl=['/home/linuxbrew/.linuxbrew/bin/kubectl','--kubeconfig','kubeconfig']
def kubernetes(kind): return json.loads(subprocess.check_output(kubectl+['get',kind,'-A','-o','json']))['items']
pve=json.loads(subprocess.check_output(['ssh','proxmox','pvesh get /cluster/resources --output-format json']))
kube_nodes=kubernetes('nodes');ingresses=kubernetes('ingress');services=kubernetes('svc')
dns=json.loads(dns_path.read_text()) if dns_path else []
documents=[];docs_by_slug={}
for section,folder in [('Architecture','infrastructure'),('Operations','admin-guide'),('User Guides','user-guide')]:
 for path in sorted((repo/'docs'/folder).glob('*.md')):
  raw=path.read_text();content=re.sub(r'^---\n.*?\n---\n','',raw,flags=re.S);content=re.sub(r'<nav\b.*?</nav>','',content,flags=re.S)
  content=re.sub(r'\]\(/([^)]*)\)',r'](https://docs.antblu.net/\1)',content)
  content=re.sub(r'\{%\s*(?:raw|endraw)\s*%\}','',content)
  title=section+' / '+path.stem
  body='> Imported from checked-in `'+str(path.relative_to(repo))+'`. Describes repository design; live observations are identified separately.\n\n'+content
  documents.append({'section':section,'title':title,'body':body});docs_by_slug.setdefault(path.stem,[]).append(title)

def node(label,typ='generic',ip=None,check='none',target=None,notes='',**extra):
 d={'label':label,'type':typ,'check_method':check,'notes':notes,**extra}
 if ip:d['ip']=ip
 if target:d['check_target']=target
 return d
host_ips={'rtx':'10.20.0.6','se350-left':'10.20.0.7','se350-right':'10.20.0.8'}
hosts=[node(n,'proxmox',ip,'tcp',ip+':8006',notes='Proxmox cluster host; address verified from corosync.',x=i*600,y=100) for i,(n,ip) in enumerate(host_ips.items())]
core=[node('Internet','isp',notes='Upstream Internet; no availability check.'),node('OPNsense','firewall','10.30.0.1','ping',notes='Router for VLANs 20, 30 and 40; AdGuard Home on port 53 forwards to Unbound on 53053.'),node('Juniper EX3300','switch',notes='Managed switch. Management IP and physical port assignments require confirmation.'),*[dict(n) for n in hosts],node('TrueNAS','nas','10.20.0.5','tcp','10.20.0.5:443',notes='TrueNAS management. Shared storage endpoints include 10.30.0.5; pool/physical cabling not inferred.')]
# Render explicit placements rather than guessed switch patching.
for i,n in enumerate(core):n['x']=(i%4)*400;n['y']=(i//4)*230
core_edges=[('Internet','OPNsense','Internet routing'),('OPNsense','Juniper EX3300','VLAN routing / switching')]
logical=[node('OPNsense','firewall','10.30.0.1','ping',x=450,y=20)]
for i,(label,cidr) in enumerate([('VLAN 20 Management','10.20.0.0/24'),('VLAN 30 Internal','10.30.0.0/24'),('VLAN 40 Virtual','10.40.0.0/24')]):
 logical.append(node(label,'groupRect',notes='Subnet '+cidr,description=cidr,width=520,height=620,x=i*620,y=220))
logical += [*[dict(n) for n in hosts],node('Debian Arc','docker_host','10.30.0.28','ssh',x=850,y=440),node('Traefik / Shared VIP','generic','10.30.0.200','tcp','10.30.0.200:443',x=850,y=640),node('HAProxy Left','vm','10.40.0.17','tcp','10.40.0.17:443',x=1450,y=440),node('HAProxy Right','vm','10.40.0.18','tcp','10.40.0.18:443',x=1450,y=640)]
# Use native Proxmox labels for the same device across every canvas.
for n in logical:
 if n['label'] in host_ips: n.update(group='VLAN 20 Management',x=80,y=100+list(host_ips).index(n['label'])*180)
 if n['label']=='Debian Arc':n['label']='debian-arc'
 if n['label']=='HAProxy Left':n['label']='haproxy-left'
 if n['label']=='HAProxy Right':n['label']='haproxy-right'
for n in logical:
 if n['label'] in ['debian-arc','Traefik / Shared VIP']: n.update(group='VLAN 30 Internal',x=80,y=100+(['debian-arc','Traefik / Shared VIP'].index(n['label']))*200)
 if n['label'].startswith('haproxy-'): n.update(group='VLAN 40 Virtual',x=80,y=100+(n['label'].endswith('right'))*200)
logical_edges=[('OPNsense',label,'Routes '+cidr) for label,cidr in [('VLAN 20 Management','10.20.0.0/24'),('VLAN 30 Internal','10.30.0.0/24'),('VLAN 40 Virtual','10.40.0.0/24')]]
pve_nodes=[*[dict(n) for n in hosts]];pve_edges=[];counts={h:0 for h in host_ips}
for g in pve:
 if g['type'] not in ['qemu','lxc']:continue
 h=g['node'];i=list(host_ips).index(h);j=counts[h];counts[h]+=1
 n=node(g['name'],'vm' if g['type']=='qemu' else 'lxc',check='none',notes='Proxmox VMID '+str(g['vmid'])+'; runtime state '+g['status']+'.',cpu_count=g.get('maxcpu'),ram_gb=g.get('maxmem',0)/2**30,disk_gb=g.get('maxdisk',0)/2**30,x=i*600,y=360+j*180)
 if g['name'].startswith('debian'): n['check_method']='ssh'
 if g['name'].startswith('haproxy'): n['check_method']='tcp'; n['check_target']=('10.40.0.17' if g['name'].endswith('left') else '10.40.0.18')+':443'
 pve_nodes.append(n);pve_edges.append((h,g['name'],'Hosts VM '+str(g['vmid'])))
k8s=[*[dict(n) for n in hosts],node('Talos Kubernetes Cluster','group',description='Six stable Talos nodes. No pod objects.',x=650,y=1400,check='none')];k8s_edges=[]
for i,n in enumerate(kube_nodes):
 label=n['metadata']['name'];ip=next(a['address'] for a in n['status']['addresses'] if a['type']=='InternalIP');control='control-plane' in n['metadata'].get('labels',{}).get('node-role.kubernetes.io/control-plane','') or 'control-plane' in label
 k8s.append(node(label,'vm',ip,'tcp',ip+':6443' if 'control' in label else ip+':9100',notes='Talos '+n['status']['nodeInfo']['osImage']+'; Kubernetes '+n['status']['nodeInfo']['kubeletVersion']+'.',x=(i%3)*600,y=380+(i//3)*350))
 guest=next((g for g in pve if g.get('name')==label),None)
 if guest:k8s_edges.append((guest['node'],label,'Hosts Talos VM'))
 k8s_edges.append((label,'Talos Kubernetes Cluster','Cluster member'))
vips={}
for s in services:
 for v in s.get('status',{}).get('loadBalancer',{}).get('ingress',[]):
  ip=v.get('ip')
  if ip:vips.setdefault(ip,[]).append(s)
for i,(ip,svcs) in enumerate(vips.items()):
 label='Traefik / Shared VIP' if ip=='10.30.0.200' else 'Service VIP '+ip
 port=443 if ip=='10.30.0.200' else next(p['port'] for p in svcs[0]['spec']['ports'] if p.get('protocol','TCP')=='TCP')
 k8s.append(node(label,'generic',ip,'tcp',ip+':'+str(port),notes='LoadBalancer services: '+', '.join(s['metadata']['namespace']+'/'+s['metadata']['name'] for s in svcs),x=(i%3)*600,y=1650+(i//3)*260))
 k8s_edges.append(('Talos Kubernetes Cluster',label,'Exposes stable service VIP'))

# Separate services are logical annotations with their own checks. They are not
# falsely collapsed into one device just because they share a Traefik VIP.
service_nodes=[];service_edges=[];seen=set();device_docs={};category_counts={}
categories={'authentik':'Identity','vaultwarden':'Identity','stalwart':'Communication','nextcloud':'Communication','obsidian':'Communication','traefik':'Networking','headscale':'Networking','rustdesk':'Networking','victoriametrics':'Monitoring','victorialogs':'Monitoring','uptime-kuma':'Monitoring','grafana':'Monitoring','argocd':'DevOps','gitlab':'DevOps','rancher':'DevOps','docs':'DevOps','litellm':'AI','open-webui':'AI','minio':'Storage','garage':'Storage'}
slug_alias={'auth':'authentik','argocd':'argocd','grafana':'victoriametrics','status':'uptime-kuma','uptime':'uptime-kuma','cloud':'nextcloud','invoice':'invoiceninja','cal':'cal-diy','flows':'activepieces','chat':'open-webui','jelly':'jellyfin','books':'virtual-machines','llama':'virtual-machines','speaches':'virtual-machines'}
entries=[]
for ing in ingresses:
 for rule in ing['spec'].get('rules',[]):
  if rule.get('host'):entries.append((rule['host'],ing['metadata']['namespace'],'Kubernetes / Traefik'))
for d in dns:
 fqdn=d['fqdn']
 if not fqdn.endswith('.antblu.net'):continue
 if d['server']=='10.30.0.27':entries.append((fqdn,slug_alias.get(fqdn.split('.')[0],'media'),'Debian / Caddy'))
entries.append(('homelable.antblu.net','homelable','Debian Arc / Caddy'))
for fqdn,ns,platform in entries:
 if fqdn in seen:continue
 seen.add(fqdn);slug=slug_alias.get(fqdn.split('.')[0],ns);category=categories.get(slug,'Media' if platform.startswith('Debian') and slug!='homelable' else 'Applications');j=category_counts.get(category,0);category_counts[category]=j+1
 n=node(fqdn,'generic',hostname=fqdn,check='https',target='https://'+fqdn,notes='Platform: '+platform+'. HTTPS checks indicate endpoint reachability, not a successful authenticated transaction.',group=category,x=40+(j%3)*270,y=80+(j//3)*130)
 service_nodes.append(n);device_docs[fqdn]=docs_by_slug.get(slug,[])
 if ns in ['authentik','argocd','victoriametrics','gitlab','nextcloud']:
  k8s.append({k:v for k,v in n.items() if k!='group'}|{'x':len(k8s)%3*600,'y':2300+len(k8s)//3*180});k8s_edges.append(('Traefik / Shared VIP',fqdn,'HTTPS virtual host'))
for h in host_ips:device_docs[h]=docs_by_slug.get('platform',[])+docs_by_slug.get('virtual-machines',[])
for n in pve_nodes:
 if n['label'] not in device_docs:device_docs[n['label']]=docs_by_slug.get('platform' if n['label'].startswith('talos') else 'virtual-machines',[])
for label,slugs in {'OPNsense':['networking'],'Juniper EX3300':['networking'],'TrueNAS':['storage'],'Traefik / Shared VIP':['traefik','metallb']}.items():device_docs[label]=sum((docs_by_slug.get(s,[]) for s in slugs),[])
for label,slug in [('Network Overview','networking'),('Proxmox Architecture','platform'),('Kubernetes Architecture','platform'),('Authentication','authentik'),('Storage','storage'),('Backups / Disaster Recovery','disaster-recovery')]:
 refs=docs_by_slug.get(slug,[]);documents.append({'section':'Architecture Overviews','title':label,'body':'# '+label+'\n\nExisting handbook references:\n\n'+'\n'.join('[[doc:'+t+'|'+t+']]' for t in refs)+'\n\nLive inventory is represented in the related canvases. VLAN MAC visibility is limited to VLAN 30 from Arc. Physical switch ports and rack U positions have not been supplied.'})
service_rows=['| Name | Platform | Check |','| --- | --- | --- |']+['| '+n['label']+' | '+n['notes'].split('.')[0]+' | HTTPS '+n['check_target']+' |' for n in service_nodes]
documents.append({'section':'Architecture Overviews','title':'Service Catalog','body':'# Service Catalog\n\n'+ '\n'.join(service_rows)+'\n\nSee each service handbook page for purpose, dependency, recovery and availability details.'})
bundle={'proxmox_host_ips':host_ips,'proxmox_host':'rtx.homelab.local','documents':documents,'device_docs':device_docs,'canvases':[{'name':'Physical / Core Network','nodes':core,'edges':core_edges},{'name':'Logical Network','nodes':logical,'edges':logical_edges},{'name':'Proxmox','nodes':pve_nodes,'edges':pve_edges},{'name':'Kubernetes','nodes':k8s,'edges':k8s_edges},{'name':'Services','groups':list(category_counts),'nodes':service_nodes,'edges':service_edges}]}
out.write_text(json.dumps(bundle));print(json.dumps({'documents':len(documents),'services':len(service_nodes),'canvases':5,'output':str(out)}))
