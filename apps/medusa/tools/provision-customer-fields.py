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
user = env.ref('medusa_integration.user_catalog', raise_if_not_found=False)
if not user or not user.active or user.group_ids != group:
    raise RuntimeError('Integration user has unexpected status or groups; review before changing access')
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
for model_name in ['res.country', 'res.country.state', 'res.partner.category']:
    location = env['ir.model'].sudo().search([('model', '=', model_name)], limit=1)
    if not location:
        raise RuntimeError('Missing location model: ' + model_name)
    if not env['ir.model.access'].sudo().search_count([('group_id', '=', group.id), ('model_id', '=', location.id)]):
        env['ir.model.access'].sudo().create({'name': 'Integration contact reference reader', 'model_id': location.id,
            'group_id': group.id, 'perm_read': True, 'perm_write': False, 'perm_create': False, 'perm_unlink': False})
# Odoo traverses bank_ids and user_ids during contact writes. Permit those
# relation searches without exposing banking or authentication records. Also
# deny writes to user-linked partners, so hiding user_ids cannot bypass Odoo's
# guard against changing contacts that own an application login. Keep those
# partners readable for email matching: hiding them would create duplicates.
for model_name, label in [('res.partner.bank', 'bank accounts'), ('res.users', 'user records')]:
    reference = env['ir.model'].sudo().search([('model', '=', model_name)], limit=1)
    if not reference:
        raise RuntimeError('Missing reference model: ' + model_name)
    if not env['ir.model.access'].sudo().search_count([('group_id', '=', group.id), ('model_id', '=', reference.id)]):
        env['ir.model.access'].sudo().create({'name': 'Integration protected relation traversal', 'model_id': reference.id,
            'group_id': group.id, 'perm_read': True, 'perm_write': False, 'perm_create': False, 'perm_unlink': False})
    rule_name = 'Medusa integration excludes ' + label
    rule = env['ir.rule'].sudo().search([('name', '=', rule_name), ('model_id', '=', reference.id)])
    values = {'name': rule_name, 'model_id': reference.id, 'domain_force': "[('id', '=', 0)]",
              'groups': [(6, 0, group.ids)], 'perm_read': True, 'perm_write': True, 'perm_create': True, 'perm_unlink': True}
    if rule:
        rule.write(values)
    else:
        env['ir.rule'].sudo().create(values)
rule_name = 'Medusa integration excludes authentication contacts'
rule = env['ir.rule'].sudo().search([('name', '=', rule_name), ('model_id', '=', model.id)])
values = {'name': rule_name, 'model_id': model.id, 'domain_force': "[('user_ids', '=', False)]",
          'groups': [(6, 0, group.ids)], 'perm_read': False, 'perm_write': True, 'perm_create': True, 'perm_unlink': True}
if rule:
    rule.write(values)
else:
    env['ir.rule'].sudo().create(values)
env.cr.commit()
# Odoo shell does not finish an HTTP request, which normally signals registry
# changes. Notify every serving worker after the committed manual-field schema.
env.registry.registry_invalidated = True
env.registry.signal_changes()
print('CUSTOMER_FIELDS_READY')
'''
if __name__ == '__main__':
    result = provision.run_odoo(SCRIPT)
    if 'CUSTOMER_FIELDS_READY' not in result.stdout:
        raise RuntimeError('Odoo did not confirm field provisioning')
    print('Odoo integration fields and contact permissions provisioned; credentials unchanged.')
