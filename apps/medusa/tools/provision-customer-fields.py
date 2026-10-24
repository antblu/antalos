#!/usr/bin/env python3
"""Provision Odoo contact integration fields/ACLs through the existing operator helper.
No keys are issued or rotated. The catalog integration user must already exist.
"""
import importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location("provision", Path(__file__).with_name("provision-odoo-integration.py"))
provision = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provision)
SCRIPT = r'''
model = env['ir.model'].sudo().search([('model', '=', 'res.partner')], limit=1)
group = env.ref('medusa_integration.catalog_reader', raise_if_not_found=False)
if not group:
    raise RuntimeError('Provision the existing integration user first')
for name, label, kind in [
    ('x_medusa_customer_id', 'Medusa Customer ID', 'char'),
    ('x_medusa_address_id', 'Medusa Address ID', 'char'),
    ('x_marketing_consent', 'Application Marketing Consent', 'boolean'),
]:
    field = env['ir.model.fields'].sudo().search([('model_id', '=', model.id), ('name', '=', name)])
    if field and field.ttype != kind:
        raise RuntimeError('Incompatible integration field: ' + name)
    if not field:
        env['ir.model.fields'].sudo().create({'model_id': model.id, 'name': name, 'field_description': label, 'ttype': kind, 'state': 'manual', 'index': True})
access = env['ir.model.access'].sudo().search([('group_id', '=', group.id), ('model_id', '=', model.id)])
values = {'name': 'Integration contact writer', 'model_id': model.id, 'group_id': group.id,
          'perm_read': True, 'perm_write': True, 'perm_create': True, 'perm_unlink': False}
if access:
    access.write(values)
else:
    env['ir.model.access'].sudo().create(values)
country = env['ir.model'].sudo().search([('model', '=', 'res.country')], limit=1)
if not env['ir.model.access'].sudo().search_count([('group_id', '=', group.id), ('model_id', '=', country.id)]):
    env['ir.model.access'].sudo().create({'name': 'Integration country reader', 'model_id': country.id,
        'group_id': group.id, 'perm_read': True, 'perm_write': False, 'perm_create': False, 'perm_unlink': False})
env.cr.commit()
print('CUSTOMER_FIELDS_READY')
'''
if __name__ == '__main__':
    result = provision.run_odoo(SCRIPT)
    if 'CUSTOMER_FIELDS_READY' not in result.stdout:
        raise RuntimeError('Odoo did not confirm field provisioning')
    print('Odoo integration fields and contact permissions provisioned; credentials unchanged.')
