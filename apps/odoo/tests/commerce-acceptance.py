"""Run through odoo shell on an isolated database; all test records roll back."""
from odoo import Command
from odoo.exceptions import AccessError, ValidationError

assert all(env['ir.module.module'].search([('name', '=', name)]).state == 'installed'
           for name in ('product', 'sale_management', 'stock', 'sale_stock', 'medusa_bridge'))
assert not env.ref('medusa_bridge.cron_medusa_delivery').active
with env.cr.savepoint():
    company = env.company
    currency = company.currency_id
    env['product.pricelist'].search([('currency_id', '=', currency.id)]).write({'active': False})
    env['product.pricelist'].create({'name': 'Bridge acceptance', 'currency_id': currency.id})
    product = env['product.product'].create({'name': 'Bridge acceptance', 'default_code': 'BRIDGE-ACCEPTANCE', 'type': 'consu', 'taxes_id': [Command.clear()]})
    user = env['res.users'].with_context(no_reset_password=True).create({
        'name': 'Bridge acceptance', 'login': 'bridge-acceptance@invalid.local',
        'group_ids': [Command.set([env.ref(x).id for x in ('base.group_user', 'base.group_partner_manager', 'sales_team.group_sale_salesman', 'stock.group_stock_user', 'medusa_bridge.group_medusa_bridge')])],
        'company_id': company.id, 'company_ids': [Command.set(company.ids)],
    })
    api = env['sale.order'].with_user(user)
    order = {'id': 'order_bridge_acceptance', 'display_id': 1, 'email': 'bridge-customer@invalid.local',
             'payment_status': 'captured', 'currency_code': currency.name.lower(), 'total': 10, 'tax_total': 0,
             'items': [{'variant_sku': product.default_code, 'quantity': 1, 'total': 10, 'tax_total': 0}]}
    payload = {'order': order}
    sale_id = api.medusa_sync('acceptance:purchase', 'purchase', payload)
    sale = api.browse(sale_id)
    assert sale.state == 'sale' and sale.amount_total == 10
    assert api.medusa_sync('acceptance:purchase', 'purchase', payload) == sale_id
    assert env['medusa.bridge.event'].search_count([('key', '=', 'acceptance:purchase')]) == 1
    for suffix, changes in [('sku', {'items': [{'variant_sku': 'MISSING', 'quantity': 1, 'total': 10}]}), ('totals', {'total': 11})]:
        bad = dict(order, id='order_acceptance_' + suffix, **changes)
        try:
            with env.cr.savepoint():
                api.medusa_sync('acceptance:' + suffix, 'purchase', {'order': bad})
        except ValidationError:
            pass
        else:
            raise AssertionError('Invalid mapping accepted: ' + suffix)
        assert not api.search_count([('medusa_order_id', '=', bad['id'])])
    api.medusa_sync('acceptance:cancel', 'cancellation', payload)
    assert sale.state == 'cancel'
    outsider = env['sale.order'].with_user(env.ref('base.public_user'))
    try:
        outsider.medusa_sync('acceptance:denied', 'purchase', payload)
    except AccessError:
        pass
    else:
        raise AssertionError('Unauthorized bridge call accepted')
env.cr.rollback()
print('COMMERCE_ACCEPTANCE_PASSED: installation, restricted user, purchase, replay, SKU/total rollback, cancellation, access denial, inactive cron')
