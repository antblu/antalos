import json
import math
from odoo import api, fields, models, Command
from odoo.exceptions import AccessError, ValidationError


class BridgeEvent(models.Model):
    _name = 'medusa.bridge.event'
    _description = 'Immutable Medusa lifecycle receipt'
    key = fields.Char(required=True, index=True)
    order_id = fields.Many2one('sale.order', required=True, ondelete='restrict')
    kind = fields.Char(required=True)
    payload = fields.Json(required=True)
    _key_unique = models.Constraint('UNIQUE(key)', 'This event has already been received.')


class SaleOrder(models.Model):
    _inherit = 'sale.order'
    medusa_order_id = fields.Char(copy=False, index=True, readonly=True)
    medusa_snapshot = fields.Json(copy=False, readonly=True)
    _medusa_unique = models.Constraint('UNIQUE(medusa_order_id)', 'This Medusa order already exists.')

    @api.model
    def medusa_sync(self, key, kind, payload):
        if not self.env.user.has_group('medusa_bridge.group_medusa_bridge'):
            raise AccessError('Medusa integration access required')
        if kind not in ('purchase', 'shipping', 'delivery', 'cancellation', 'refund', 'processing'):
            raise ValidationError('Unsupported lifecycle event')
        order = payload.get('order', {})
        order_id = order.get('id')
        if not isinstance(order_id, str) or not order_id.startswith('order_') or not isinstance(key, str) or len(key) > 300:
            raise ValidationError('Invalid Medusa order/event')
        # Transaction-scoped, server-side lock: survives client disconnects and
        # serializes independent Medusa workers before search/create.
        self.env.cr.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))', [order_id])
        events = self.env['medusa.bridge.event']
        prior = events.search([('key', '=', key)], limit=1)
        if prior:
            if prior.order_id.medusa_order_id != order_id:
                raise ValidationError('Event linkage conflict')
            return prior.order_id.id
        sale = self.search([('medusa_order_id', '=', order_id)], limit=1)
        if not sale:
            if kind != 'purchase':
                raise ValidationError('Purchase must be synchronized first')
            if order.get('payment_status') not in ('captured', 'partially_refunded', 'refunded'):
                raise ValidationError('Order payment is not confirmed')
            sale = self._medusa_create_order(order)
        # The full safe commerce snapshot retains discounts, taxes, provider
        # status, addresses, tracking and references without issuing payments.
        if kind == 'cancellation' and sale.state != 'cancel':
            if sale.invoice_ids.filtered(lambda invoice: invoice.state == 'posted') or sale.picking_ids.filtered(lambda picking: picking.state == 'done'):
                raise ValidationError('Posted invoice or completed shipment requires cancellation review')
            sale.action_cancel()
        events.create({'key': key, 'kind': kind, 'order_id': sale.id, 'payload': payload})
        sale.write({'medusa_snapshot': payload})
        return sale.id

    @api.model
    def _medusa_create_order(self, order):
        email = order.get('email', '').strip().lower()
        customer_id = order.get('customer_id')
        domain = [('email', '=ilike', email), ('parent_id', '=', False)]
        partners = self.env['res.partner'].search(domain, limit=2)
        if len(partners) > 1 or not email:
            raise ValidationError('Customer mapping requires review')
        if partners and customer_id and 'x_medusa_customer_id' in partners._fields and partners.x_medusa_customer_id and partners.x_medusa_customer_id != customer_id:
            raise ValidationError('Customer linkage conflict')
        address = order.get('billing_address') or order.get('shipping_address') or {}
        partner = partners or self.env['res.partner'].create({'name': ' '.join(filter(None, [address.get('first_name'), address.get('last_name')])) or email, 'email': email})
        if customer_id and 'x_medusa_customer_id' in partner._fields:
            partner.write({'x_medusa_customer_id': customer_id})
        currency = self.env['res.currency'].search([('name', '=', order.get('currency_code', '').upper()), ('active', '=', True)], limit=1)
        pricelists = self.env['product.pricelist'].search([('currency_id', '=', currency.id), ('company_id', 'in', [False, self.env.company.id])], limit=2)
        if not currency or len(pricelists) != 1:
            raise ValidationError('Configure exactly one eligible pricelist for the order currency')
        values = {'partner_id': partner.id, 'pricelist_id': pricelists.id, 'medusa_order_id': order['id'], 'client_order_ref': str(order['display_id']), 'order_line': []}
        for field, role in [('billing_address', 'invoice'), ('shipping_address', 'delivery')]:
            a = order.get(field)
            if not a:
                continue
            country = self.env['res.country'].search([('code', '=', a.get('country_code', '').upper())], limit=1)
            if not country:
                raise ValidationError('Address country mapping missing')
            child = self.env['res.partner'].create({'parent_id': partner.id, 'type': role, 'name': ' '.join(filter(None, [a.get('first_name'), a.get('last_name')])) or partner.name, 'street': a.get('address_1'), 'street2': a.get('address_2'), 'city': a.get('city'), 'zip': a.get('postal_code'), 'country_id': country.id})
            values['partner_invoice_id' if role == 'invoice' else 'partner_shipping_id'] = child.id
        for item in order.get('items', []):
            sku = item.get('variant_sku')
            products = self.env['product.product'].search([('default_code', '=', sku), ('sale_ok', '=', True)], limit=2) if sku else self.env['product.product']
            if len(products) != 1:
                raise ValidationError('Missing or ambiguous SKU mapping')
            quantity = float(item.get('quantity', 0))
            if not math.isfinite(quantity) or quantity <= 0:
                raise ValidationError('Invalid item quantity')
            # Use the tax-exclusive net line amount, preserving discounts in the
            # snapshot. Odoo configured taxes must reproduce Medusa's tax total.
            net = float(item['total']) - float(item.get('tax_total', 0))
            if not math.isfinite(net) or net < 0:
                raise ValidationError('Invalid item amount')
            values['order_line'].append(Command.create({'product_id': products.id, 'name': item.get('product_title') or item.get('title') or products.name, 'product_uom_qty': quantity, 'price_unit': net / quantity, 'tax_ids': [Command.set(products.taxes_id.filtered(lambda t: t.company_id == self.env.company and not t.price_include).ids)]}))
        if not values['order_line']:
            raise ValidationError('Order has no mapped items')
        shipping = float(order.get('shipping_total', 0))
        if shipping:
            sku = self.env['ir.config_parameter'].sudo().get_param('medusa_bridge.shipping_sku')
            products = self.env['product.product'].search([('default_code', '=', sku), ('type', '=', 'service')], limit=2) if sku else self.env['product.product']
            if len(products) != 1:
                raise ValidationError('Shipping service SKU mapping is required')
            # Net shipping must be supplied explicitly when shipping is taxed.
            net_shipping = shipping - float(order.get('shipping_tax_total', 0))
            values['order_line'].append(Command.create({'product_id': products.id, 'product_uom_qty': 1, 'price_unit': net_shipping, 'tax_ids': [Command.set(products.taxes_id.filtered(lambda t: t.company_id == self.env.company and not t.price_include).ids)]}))
        sale = self.create(values)
        if currency.compare_amounts(sale.amount_total, float(order['total'])) or currency.compare_amounts(sale.amount_tax, float(order.get('tax_total', 0))):
            raise ValidationError('Odoo totals or tax mapping differ from Medusa; transaction rolled back')
        sale.action_confirm()
        return sale
