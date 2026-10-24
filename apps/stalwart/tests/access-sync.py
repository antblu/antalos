"""Exercise native role grant/removal without modifying live accounts."""
import copy
import sys
sys.dont_write_bytecode = True
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('stalwart_access', Path(__file__).parents[1]/'tools/reconcile-access.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
accounts = [
    {'id':'users','@type':'Group','name':'stalwart-users','domainId':'domain','roles':{'@type':'Default'}},
    {'id':'admins','@type':'Group','name':'stalwart-admins','domainId':'domain',
     'roles':{'@type':'Custom','roleIds':{'system-admin':True}}},
    {'id':'person','@type':'User','emailAddress':'person@example.org','roles':{'@type':'User'},
     'permissions':{'@type':'Inherit'},'memberGroupIds':{'unrelated':True},'credentials':['unchanged']},
    {'id':'local','@type':'User','emailAddress':'recovery@example.org','roles':{'@type':'Admin'}},
]
original_local=copy.deepcopy(accounts[-1])
mutations=[]

def api(obj, action, values=None):
    if action=='get':
        return {'list':copy.deepcopy({'Account':accounts,'Directory':[{'id':'oidc','@type':'Oidc','claimGroups':'stalwart_groups'}],
             'Authentication':[{'directoryId':'oidc'}],'Domain':[{'id':'domain','name':'example.org'}],
             'Role':[{'id':'system-admin','description':'System Administrator'}]}[obj])}
    mutations.append((obj,copy.deepcopy(values)))
    if obj=='Account':
        for identity, patch in values['update'].items():
            next(a for a in accounts if a['id']==identity).update(patch)
    return {}


def sync(user, admin, apply=True):
    module.reconcile(api, {'person@example.org':{'user':user,'admin':admin}},'example.org',apply)

sync(True,True,False)
assert not mutations and accounts[2]['roles']=={'@type':'User'}
sync(True,True)
assert accounts[2]['roles']=={'@type':'Admin'}
assert accounts[2]['memberGroupIds']=={'unrelated':True,'users':True,'admins':True}
count=len(mutations)
sync(True,True)
assert len(mutations)==count, 'Repeat run mutated state or reloaded settings'
sync(True,False)
assert accounts[2]['roles']=={'@type':'User'} and 'admins' not in accounts[2]['memberGroupIds']
sync(True,True)
sync(False,False)  # Disabled identity or removal from the whole app structure.
assert accounts[2]['roles']=={'@type':'User'} and accounts[2]['memberGroupIds']=={'unrelated':True}
assert accounts[2]['credentials']==['unchanged'] and accounts[-1]==original_local
accounts[2]['permissions']={'@type':'Custom'}
try:
    sync(True,True)
except RuntimeError:
    pass
else:
    raise AssertionError('Explicit custom permissions accepted')
print('STALWART_ROLE_CHECK grant, demotion, disabled/removal, idempotency and recovery-account preservation passed')
