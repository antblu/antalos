import hashlib
import hmac
import json
import logging
import os
import time
from datetime import timedelta
from urllib.parse import urlparse
import requests
from odoo import api, fields, models
from odoo.exceptions import ValidationError
_logger = logging.getLogger(__name__)


class Picking(models.Model):
    _inherit = 'stock.picking'
    medusa_fulfillment_id = fields.Char(copy=False)
    medusa_carrier = fields.Char(copy=False)
    medusa_tracking_number = fields.Char(copy=False)
    medusa_tracking_url = fields.Char(copy=False)
    medusa_delivery_confirmed = fields.Boolean(copy=False, help='Set only after reliable carrier or delivery confirmation.')

    def write(self, values):
        result = super().write(values)
        if {'state', 'medusa_fulfillment_id', 'medusa_tracking_number', 'medusa_tracking_url', 'medusa_carrier', 'medusa_delivery_confirmed'} & values.keys():
            for picking in self.filtered(lambda p: p.state == 'done' and p.picking_type_code == 'outgoing' and p.medusa_fulfillment_id and p.sale_id.medusa_order_id):
                if not picking.medusa_tracking_number or not picking.medusa_tracking_url:
                    continue
                outbox = self.env['medusa.bridge.outbound'].sudo()
                # Queue shipment first even when delivery evidence arrives in
                # the same update. Delivery must never precede shipment.
                for status in (['shipped', 'delivered'] if picking.medusa_delivery_confirmed else ['shipped']):
                    key = f'{picking.id}:{status}'
                    self.env.cr.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))', [key])
                    if not outbox.search_count([('key', '=', key)]):
                        outbox.create({'key': key, 'payload': {'order_id': picking.sale_id.medusa_order_id, 'fulfillment_id': picking.medusa_fulfillment_id, 'status': status, 'carrier': picking.medusa_carrier or '', 'labels': [{'tracking_number': picking.medusa_tracking_number, 'tracking_url': picking.medusa_tracking_url}]}})

        return result


class Outbound(models.Model):
    _name = 'medusa.bridge.outbound'
    _description = 'Medusa fulfillment delivery queue'
    key = fields.Char(required=True)
    payload = fields.Json(required=True)
    sent = fields.Boolean(default=False)
    attempts = fields.Integer(default=0)
    available_at = fields.Datetime(default=fields.Datetime.now, required=True)
    _key_unique = models.Constraint('UNIQUE(key)', 'This fulfillment event is already queued.')

    @api.model
    def dispatch(self):
        endpoint = os.environ.get('MEDUSA_FULFILLMENT_URL', '')
        secret = os.environ.get('FULFILLMENT_WEBHOOK_SECRET', '')
        url = urlparse(endpoint)
        if url.scheme != 'https' or not url.hostname or url.username or url.password or len(secret) < 32:
            _logger.warning('medusa_bridge.delivery_not_configured')
            return
        tasks = self.search([('sent', '=', False), ('available_at', '<=', fields.Datetime.now())], limit=20, order='id')
        for task in tasks:
            self.env.cr.execute('SELECT id FROM medusa_bridge_outbound WHERE id=%s FOR UPDATE SKIP LOCKED', [task.id])
            if not self.env.cr.fetchone():
                continue
            raw = json.dumps(task.payload, separators=(',', ':')).encode()
            timestamp = str(int(time.time()))
            signature = hmac.new(secret.encode(), timestamp.encode() + b'.' + raw, hashlib.sha256).hexdigest()
            try:
                response = requests.post(endpoint, data=raw, headers={'Content-Type': 'application/json', 'X-Commerce-Timestamp': timestamp, 'X-Commerce-Signature': signature}, timeout=15, allow_redirects=False)
                if response.status_code != 200 or response.json().get('accepted') is not True:
                    raise ValidationError('Delivery not accepted')
                task.write({'sent': True, 'attempts': task.attempts + 1})
            except (requests.RequestException, ValueError, ValidationError):
                attempts = task.attempts + 1
                task.write({'attempts': attempts, 'available_at': fields.Datetime.now() + timedelta(seconds=min(86400, 30 * 2 ** min(attempts, 12)))})
                _logger.warning('medusa_bridge.delivery_retry event_id=%s attempts=%s', task.id, attempts)
