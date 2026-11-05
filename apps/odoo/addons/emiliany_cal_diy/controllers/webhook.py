import os

from odoo import http
from odoo.http import request

from ..services.webhook import InvalidWebhook, MAX_BODY_BYTES, parse_webhook


class CalWebhook(http.Controller):
    @http.route('/cal-diy/webhook', type='http', auth='public', methods=['POST'], csrf=False, save_session=False)
    def webhook(self, **_kwargs):
        if os.environ.get('CAL_DIY_SYNC_ENABLED', '').lower() != 'true':
            return request.make_response('', status=503)
        if request.httprequest.content_length is None or request.httprequest.content_length > MAX_BODY_BYTES:
            return request.make_response('', status=413)
        if request.httprequest.mimetype != 'application/json':
            return request.make_response('', status=415)
        try:
            body = request.httprequest.get_data(cache=True)
            event, digest = parse_webhook(body, request.httprequest.headers.get('X-Cal-Signature-256'),
                                          os.environ.get('CAL_DIY_WEBHOOK_SECRET'))
        except InvalidWebhook:
            return request.make_response('', status=400)
        request.env['emiliany.cal.delivery'].sudo().receive_http(digest, event['payload']['uid'])
        return request.make_response('', status=202)
