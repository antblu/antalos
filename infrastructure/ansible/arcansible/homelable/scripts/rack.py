"""Reconcile workbook rack placements while retaining unrelated rack objects."""
import uuid,re
from api import api

def reconcile_rack(physical,node_results):
 designs=api('/designs'); name='12U Rack'
 design=next((d for d in designs if d['name']==name),None)
 if design is None:design=api('/designs',{'name':name,'icon':'server','design_type':'rack'})
 if design['design_type']!='rack':raise ValueError('12U Rack exists with a different design type')
 state=api('/racks?design_id='+design['id'])
 def ident(label):return str(uuid.uuid5(uuid.NAMESPACE_URL,'antalos/homelable/rack/'+label))
 def upsert(items,value):
  index=next((i for i,o in enumerate(items) if o['id']==value['id']),None)
  if index is None:items.append(value)
  else:items[index]=value
 rid=ident(physical['rack']['name'])
 upsert(state['racks'],{'id':rid,**physical['rack'],'location':'600mm enclosed rack; source: user workbook','style':{'enclosed':True,'showNumbers':True},'pos_x':0,'pos_y':0})
 mounts={}
 for spec in physical['mounts']:
  label=spec['label'];n=node_results[('Physical / Core Network',label)]
  mount={'id':ident(label),'rack_id':rid,'device_id':n.get('device_id'),'node_id':n['id'],**spec,'ports':[],'port_visibility':'always','col_start':spec.get('col_start',0),'col_span':spec.get('col_span',12)}
  mounts[label]=mount
 switch=mounts['Juniper EX3300']
 for i in range(24):switch['ports'].append({'id':'ge-0/0/'+str(i),'label':'ge-0/0/'+str(i),'type':'rj45','x':0.05+0.065*(i//2),'y':0.32 if i%2==0 else 0.68})
 for i in range(4):switch['ports'].append({'id':'xe-0/1/'+str(i),'label':'xe-0/1/'+str(i),'type':'sfp+','x':0.84+0.035*i,'y':0.5})
 # The workbook identifies switch sockets but not peer OS interface names.
 # Peer sockets therefore use descriptive roles, never invented eth/eno names.
 for c in physical['connections']:
  target=mounts.get(c.get('mount',c['device']))
  if target is None:continue # UPS/AP/PC have no supplied rack position.
  for p in c['ports']:
   pid=c['device']+'@'+p;typ='sfp+' if p.startswith('xe') else 'rj45'
   target['ports'].append({'id':pid,'label':c['device']+' / '+p,'type':typ,'x':0.5,'y':0.5})
   props=[{'key':k,'value':c[k],'visible':True} for k in ['mode','vlans','speed']]
   if c.get('aggregation'):props.append({'key':'aggregation','value':c['aggregation'],'visible':True})
   props.append({'key':'Path','value':'Endpoint relation; patch-panel socket route unspecified','visible':False})
   cable={'id':ident('cable/'+p),'from_device_id':switch['id'],'from_port_id':p,'to_device_id':target['id'],'to_port_id':pid,'type':'ethernet','color':'#39d353' if typ=='sfp+' else '#58a6ff','label':p+' → '+c['device'],'label_visible':True,'properties':props}
   upsert(state['cables'],cable)
 for m in mounts.values():
  if m['label']=='Panduit 24-Port Cat6 Patch Coupler':
   m['ports']=[{'id':'patch-'+str(i+1),'label':str(i+1),'type':'rj45','x':0.04+i*0.04,'y':0.5} for i in range(24)]
  elif m['label']=='OPNsense':
   m['ports'].append({'id':'wan','label':'WAN (peer port unspecified)','type':'rj45','x':0.8,'y':0.5})
  for i,p in enumerate(m['ports']):
   if m['label'] not in ['Juniper EX3300','Panduit 24-Port Cat6 Patch Coupler']:
    p.update(x=0.15+0.7*(i+1)/(len(m['ports'])+1),y=0.5)
  upsert(state['devices'],m)
 api('/racks/save',{'design_id':design['id'],**state})
 # Add a source section to existing device notes without discarding other text.
 docs=api('/documents')
 for label,m in mounts.items():
  d=next((d for d in docs if d.get('device_id')==m['device_id']),None)
  if not d:continue
  full=api('/documents/'+d['id']);body=re.sub(r'\n<!-- workbook-physical -->.*?<!-- /workbook-physical -->','',full['body'],flags=re.S)
  body+='\n<!-- workbook-physical -->\n## Physical placement\n\n'+physical['rack']['name']+' U'+str(m['u_start'])+'–'+str(m['u_start']+m['u_height']-1)+'.\n\n[[doc:Physical Rack and Switch Map|Physical Rack and Switch Map]]\n<!-- /workbook-physical -->'
  if full['body']!=body:api('/documents/'+d['id'],{'body':body,'revision_reason':'import'},'PATCH')
 return {'rack_design':design['id'],'mounts':len(mounts),'switch_ports':len(switch['ports']),'mapped_ports':sum(len(c['ports']) for c in physical['connections'])}
