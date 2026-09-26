#!/usr/bin/env python3
"""Reconcile explicitly supplied architecture and handbook data through Homelable APIs.

Run as root on Arc with a JSON bundle made by export.py on the controller.
Never removes objects or accepts unknown scan results. Matches by design+label,
then by device identity. Unchanged document bodies produce no new revisions.
"""
import json, sys, pathlib
from api import api

bundle = json.loads(pathlib.Path(sys.argv[1]).read_text())
designs = {d['name']:d for d in api('/designs')}
# Reuse the empty initial canvas instead of adding an unused default diagram.
if 'Physical / Core Network' not in designs and 'Network Topology' in designs:
 d=designs.pop('Network Topology')
 if not d.get('node_count'):
  designs['Physical / Core Network']=api('/designs/'+d['id'],{'name':'Physical / Core Network'},'PUT')
for name in ['Physical / Core Network','Logical Network','Proxmox','Kubernetes','Services']:
 if name not in designs: designs[name]=api('/designs',{'name':name,'icon':'dashboard'})

pve=api('/proxmox/import',{'host':bundle['proxmox_host'],'verify_tls':True})
pve_by_name={n['label']:n for n in pve['nodes']}
# Correlate Proxmox host identities (native importer omits host IP) with the
# independently scanned management IP, preserving the native inventory row.
inventory=api('/scan/pending')
for name,ip in bundle.get('proxmox_host_ips',{}).items():
    native=pve_by_name.get(name)
    if not native: continue
    winner=native['device_id']
    losers=[d['id'] for d in inventory if d.get('ip')==ip and d['id']!=winner]
    if losers: api('/scan/pending/merge',{'winner_id':winner,'loser_ids':losers})
    api('/scan/pending/'+winner,{'ip':ip,'label':name,'hostname':name},'PATCH')
all_nodes=api('/nodes')
node_by_key={(n.get('design_id'),n['label']):n for n in all_nodes}
inventory=api('/scan/pending')
inv_by_ip={d['ip']:d for d in inventory if d.get('ip')}
inv_by_name={d.get('label') or d.get('friendly_name') or d.get('hostname'):d for d in inventory}
node_results={}

def place(canvas,label,facts,x,y,parent=None):
 design_id=designs[canvas]['id']; existing=node_by_key.get((design_id,label))
 payload={**facts,'label':label,'pos_x':x,'pos_y':y,'parent_id':parent}
 if existing:
  node=api('/nodes/'+existing['id'],payload,'PATCH')
 else:
  payload['design_id']=design_id
  native=pve_by_name.get(label)
  device=(next((d for d in inventory if d['id']==native.get('device_id')),None) if native else None)
  if device is None and facts.get('ip'): device=inv_by_ip.get(facts['ip'])
  if device is None: device=inv_by_name.get(label)
  if device and facts['type'] not in ['group','groupRect','text']:
   response=api('/scan/pending/'+device['id']+'/approve',payload)
   node=api('/nodes/'+response['node_id'])
  else: node=api('/nodes',payload)
  node_by_key[(design_id,label)]=node
  if node.get('device_id'): inv_by_name[label]={'id':node['device_id'],'ip':node.get('ip')}

 node_results[(canvas,label)]=node
 return node

# Approved native identities are shared across canvases, not duplicated devices.
for spec in bundle['canvases']:
 canvas=spec['name']; groups={}
 for gi,g in enumerate(spec.get('groups',[])):
  groups[g]=place(canvas,g,{'type':'groupRect','description':g,'check_method':'none','width':900,'height':max(540,180+140*((sum(n.get('group')==g for n in spec['nodes'])+2)//3))},(gi%2)*1000,(gi//2)*1400)
 for ni,item in enumerate(spec['nodes']):
  item=dict(item);label=item.pop('label');group=item.pop('group',None)
  parent=(groups.get(group) or node_results.get((canvas,group)))['id'] if group else None
  x=item.pop('x',40+(ni%3)*270);y=item.pop('y',90+(ni//3)*140)
  if label in pve_by_name:
   native=pve_by_name[label]
   for key in ['ip','cpu_count','ram_gb','disk_gb']:
    if native.get(key) is not None and key not in item: item[key]=native[key]
   item['show_hardware']=True
  place(canvas,label,item,x,y,parent)
 existing_edges={(e['source'],e['target'],e.get('label')):e for e in api('/edges?design_id='+designs[canvas]['id'])}
 for src,dst,label in spec.get('edges',[]):
  a=node_results.get((canvas,src));b=node_results.get((canvas,dst))
  if not a or not b: continue
  key=(a['id'],b['id'],label)
  edge_type='virtual' if canvas in ['Proxmox','Kubernetes','Services'] else ('vlan' if canvas=='Logical Network' else 'ethernet')
  style={'type':edge_type,'marker_end':'arrow'}
  if key not in existing_edges:
   api('/edges',{'design_id':designs[canvas]['id'],'source':a['id'],'target':b['id'],'label':label,**style})
  elif any(existing_edges[key].get(k)!=v for k,v in style.items()):
   api('/edges/'+existing_edges[key]['id'],style,'PATCH')

# Pages carry their checked-in source; device documentation follows the inventory
# row and is visible from every canvas that draws it.
documents=api('/documents');doc_by_title={d['title']:d for d in documents}
folders={}
for name in ['Architecture','Operations','User Guides','Architecture Overviews']:
 old=doc_by_title.get(name)
 folders[name]=old or api('/documents',{'kind':'folder','title':name})
for page in bundle['documents']:
 parent=folders[page['section']]['id'];old=doc_by_title.get(page['title'])
 if old:
  current=api('/documents/'+old['id'])
  if current['body']!=page['body']: api('/documents/'+old['id'],{'body':page['body'],'revision_reason':'import'},'PATCH')
 else:
  doc_by_title[page['title']]=api('/documents',{'kind':'page','title':page['title'],'parent_id':parent,'body':page['body']})

by_device={d['device_id']:d for d in api('/documents') if d.get('device_id')}
linked=0
for (canvas,label),n in node_results.items():
 device_id=n.get('device_id')
 if not device_id or device_id in by_device: continue
 refs=bundle['device_docs'].get(label,[])
 body='# '+label+'\n\n'+(n.get('notes') or 'Durable Antalos infrastructure object.')+'\n\n'
 body+='## Related documentation\n\n'+ '\n'.join('[[doc:'+doc_by_title[t]['id']+'|'+t+']]' for t in refs if t in doc_by_title)
 body+='\n\n## Monitoring\n\nMethod: '+str(n.get('check_method') or 'none')+'\n\nTarget: '+str(n.get('check_target') or n.get('ip') or 'not applicable')+'\n'
 d=api('/documents',{'kind':'device','title':label,'device_id':device_id,'body':body});by_device[device_id]=d;linked+=1
print(json.dumps({'designs':len(designs),'canvas_nodes':len(node_results),'documents':len(api('/documents')),'new_device_documents':linked,'proxmox_devices':pve['device_count']}))

if bundle.get('physical'):
 from rack import reconcile_rack
 print(json.dumps(reconcile_rack(bundle['physical'],node_results)))
 # Retired services remain recoverable, with no monitoring or catalog entry.
 retired=[n for n in all_nodes if n['label'] in bundle['physical']['retired_services']]
 if retired:
  group=place('Services','Retired services',{'type':'groupRect','description':'Retired by owner; monitoring disabled; documents retained','check_method':'none','width':900,'height':420},0,7000)
  for n in retired:
   note=(n.get('notes') or '').split('\nRetired by owner:')[0]+'\nRetired by owner: ytdlp2strm removed. Monitoring disabled; history/documentation retained.'
   api('/nodes/'+n['id'],{'parent_id':group['id'],'check_method':'none','status':'unknown','notes':note,'pos_x':40,'pos_y':90},'PATCH')
   if n.get('device_id'):api('/scan/pending/'+n['device_id']+'/hide',{},'POST')
  print(json.dumps({'retired_service_instances':len(retired)}))
