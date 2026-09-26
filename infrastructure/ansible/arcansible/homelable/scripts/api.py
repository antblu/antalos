import urllib.request,json,pathlib,sys
root=pathlib.Path('/opt/compose/homelable')
keys={k:v.strip().strip("'") for k,v in (line.split('=',1) for line in (root/'backend.env').read_text().splitlines() if '=' in line)}
base='http://172.17.0.1:8000/api/v1'
def api(path,data=None,method=None):
 req=urllib.request.Request(base+path,data=json.dumps(data).encode() if data is not None else None,headers={'X-MCP-Service-Key':keys['MCP_SERVICE_KEY'],'Content-Type':'application/json'},method=method)
 with urllib.request.urlopen(req,timeout=90) as r: return json.load(r) if r.status!=204 else None
if __name__=='__main__':
 result=api(sys.argv[1],json.loads(sys.argv[2]) if len(sys.argv)>2 else None,sys.argv[3] if len(sys.argv)>3 else None)
 print(json.dumps(result,indent=2))
