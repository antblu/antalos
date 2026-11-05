"""Native acceptance on an isolated, accounting-configured database. Never sends mail."""
from odoo import Command
from odoo.exceptions import AccessError, ValidationError

company = env.company
params = env['ir.config_parameter'].sudo()
config = lambda name: 'medusa_bridge.' + name + '.' + str(company.id)
assert params.get_param(config('invoice_enabled')) == 'true'
with env.cr.savepoint():
    user = env['res.users'].with_context(no_reset_password=True).create({
        'name': 'Invoice acceptance', 'login': 'invoice-acceptance@invalid.local',
        'company_id': company.id, 'company_ids': [Command.set(company.ids)],
        'group_ids': [Command.set([env.ref(x).id for x in (
            'base.group_user', 'base.group_partner_manager', 'sales_team.group_sale_salesman',
            'stock.group_stock_user', 'medusa_bridge.group_medusa_bridge')])],
    })
    assert not user.has_group('account.group_account_invoice')
    product = env['product.product'].create({
        'name': 'Invoice acceptance', 'default_code': 'INVOICE-ACCEPTANCE',
        'type': 'service', 'invoice_policy': 'order', 'taxes_id': [Command.clear()],
    })
    api = env['sale.order'].with_user(user)
    order = {'id': 'order_invoice_acceptance', 'display_id': 99001,
             'email': 'invoice-acceptance@invalid.local', 'currency_code': company.currency_id.name.lower(),
             'payment_status': 'captured', 'total': 10, 'tax_total': 0,
             'items': [{'variant_sku': product.default_code, 'quantity': 1, 'total': 10, 'tax_total': 0}]}
    sale_id = api.medusa_sync('invoice:purchase', 'purchase', {'order': order})
    sale = env['sale.order'].browse(sale_id)
    invoice, payment, mail = sale.medusa_invoice_id, sale.medusa_payment_id, sale.medusa_invoice_mail_id
    assert invoice.state == 'posted' and invoice.amount_total == 10
    assert invoice.currency_id.is_zero(invoice.amount_residual)
    assert payment and mail.state == 'outgoing' and mail.email_to == order['email']
    assert len(mail.attachment_ids) == 1
    assert mail.attachment_ids.raw.startswith(b'%PDF-')
    assert 'No additional payment' in mail.body_html
    assert api.medusa_sync('invoice:purchase', 'purchase', {'order': order}) == sale_id
    assert api.medusa_sync('invoice:alternate-event', 'purchase', {'order': order}) == sale_id
    assert sale.medusa_invoice_id == invoice and sale.medusa_invoice_mail_id == mail
    assert len(sale.invoice_ids) == 1
    assert env['mail.mail'].search_count([('model', '=', 'account.move'), ('res_id', '=', invoice.id)]) == 1

    for suffix, changes in [
        ('authorized', {'payment_status': 'authorized'}),
        ('refunded', {'payment_status': 'refunded'}),
        ('total', {'total': 11}),
        ('sku', {'items': [{'variant_sku': 'UNMAPPED', 'quantity': 1, 'total': 10}]}),
    ]:
        bad = dict(order, id='order_invoice_' + suffix, **changes)
        try:
            with env.cr.savepoint():
                api.medusa_sync('invoice:' + suffix, 'purchase', {'order': bad})
        except ValidationError:
            pass
        else:
            raise AssertionError('Invalid invoice accepted: ' + suffix)
        assert not api.search_count([('medusa_order_id', '=', bad['id'])])

    delivery_product = env['product.product'].create({
        'name': 'Delivery-only invoice acceptance', 'default_code': 'INVOICE-DELIVERY-ONLY',
        'type': 'consu', 'invoice_policy': 'delivery', 'taxes_id': [Command.clear()],
    })
    partial = dict(order, id='order_invoice_partial', total=20, items=order['items'] + [
        {'variant_sku': delivery_product.default_code, 'quantity': 1, 'total': 10, 'tax_total': 0}])
    try:
        with env.cr.savepoint():
            api.medusa_sync('invoice:partial', 'purchase', {'order': partial})
    except ValidationError:
        pass
    else:
        raise AssertionError('Partial invoice was posted for an undelivered item')
    assert not api.search_count([('medusa_order_id', '=', partial['id'])])

    previous = params.get_param(config('payment_journal_id'))
    params.set_param(config('payment_journal_id'), 0)
    try:
        with env.cr.savepoint():
            api.medusa_sync('invoice:no-journal', 'purchase', {'order': dict(order, id='order_invoice_no_journal')})
    except ValidationError:
        pass
    else:
        raise AssertionError('Missing clearing journal accepted')
    assert not api.search_count([('medusa_order_id', '=', 'order_invoice_no_journal')])
    params.set_param(config('payment_journal_id'), previous)
    try:
        sale.with_user(env.ref('base.public_user'))._medusa_issue_invoice(order)
    except AccessError:
        pass
    else:
        raise AssertionError('Unauthorized accounting escalation accepted')
    params.set_param(config('invoice_enabled'), 'false')
    disabled = api.medusa_sync('invoice:disabled', 'purchase', {'order': dict(order, id='order_invoice_disabled')})
    assert not env['sale.order'].browse(disabled).medusa_invoice_id

env.cr.rollback()
print('INVOICE_ACCEPTANCE_PASSED: restricted caller, paid invoice/PDF/queue, replay, invalid states/mappings, rollback, access denial, disabled gate; no email sent')
