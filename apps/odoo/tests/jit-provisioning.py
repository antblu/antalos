# Run through odoo shell with the deployed runtime config. All changes roll back.
import uuid
from odoo.exceptions import AccessDenied

provider=env['auth.oauth.provider'].sudo().search([('name','=','antID')])
template=provider.jit_user_template_id
users=env['res.users'].sudo().with_context(active_test=False)
before=users.search_count([])
nonce=uuid.uuid4().hex
email='jit-check-'+nonce+'@example.invalid'
subject='jit-check-'+nonce
params={'access_token':'temporary-transaction-test-token'}

def rejected(validation):
    count=users.search_count([])
    try:
        users._auth_oauth_signin(provider.id,validation,params)
    except AccessDenied:
        assert users.search_count([])==count
    else:
        raise AssertionError('JIT accepted a denied identity')

try:
    rejected({'groups':['odoo-users'],'user_id':subject+'-unverified','email':email,'email_verified':False})
    print('JIT_CHECK unverified identity rejected without creating a user')
    login=users._auth_oauth_signin(provider.id,{'groups':['odoo-users'],'user_id':subject,'email':email,'email_verified':True,'name':'Temporary JIT Transaction Check'},params)
    user=users.search([('login','=',login)])
    assert user.has_group('base.group_user') and not user.share
    assert set(user.group_ids.ids)==set(template.group_ids.ids)
    assert set(user.company_ids.ids)==set(template.company_ids.ids)
    assert user.company_id==template.company_id
    assert user.oauth_provider_id==provider and user.oauth_uid==subject
    print('JIT_CHECK new user created as internal with matching template groups and companies')
    assert users._auth_oauth_signin(provider.id,{'groups':['odoo-users'],'user_id':subject,'email':'changed@example.invalid','email_verified':False},params)==login
    assert users.search_count([])==before+1
    print('JIT_CHECK returning subject retains the existing identity without duplicate users')
    users._auth_oauth_signin(provider.id, {'groups':['odoo-users','odoo-admins'],'user_id':subject}, params)
    assert user.has_group('base.group_system')
    users._auth_oauth_signin(provider.id, {'groups':['odoo-users'],'user_id':subject}, params)
    assert not user.has_group('base.group_system') and not user.has_group('base.group_erp_manager')
    rejected({'user_id':subject})
    print('JIT_CHECK admin grant, removal and missing-group denial verified')
    user.active=False
    rejected({'groups':['odoo-users'],'user_id':subject,'email':email,'email_verified':True})
    print('JIT_CHECK archived subject rejected without replacement')
    linked_email='jit-link-'+nonce+'@example.invalid'
    existing=users.with_context(no_reset_password=True,mail_create_nosubscribe=True).create({
        'login':linked_email,'email':linked_email,'name':'Temporary JIT Link Check',
        'group_ids':[(6,0,template.group_ids.ids)],
        'company_id':template.company_id.id,'company_ids':[(6,0,template.company_ids.ids)],
    })
    groups=set(existing.group_ids.ids)
    assert users._auth_oauth_signin(provider.id,{'groups':['odoo-users'],'user_id':subject+'-link','email':linked_email.upper(),'email_verified':True},params)==linked_email
    assert existing.oauth_uid==subject+'-link' and existing.oauth_provider_id==provider
    assert set(existing.group_ids.ids)==groups and users.search_count([])==before+2
    print('JIT_CHECK verified email links the existing user and preserves permissions')
finally:
    env.cr.rollback()
assert users.search_count([])==before
print('JIT_CHECK all test database changes rolled back; persistent user count unchanged')
