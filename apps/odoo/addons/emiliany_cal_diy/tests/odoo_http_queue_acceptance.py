"""Continue http_acceptance.py in the same disposable database; rollback changes."""
import os
from unittest.mock import patch
from odoo.addons.emiliany_cal_diy.models import integration

os.environ['CAL_DIY_SYNC_ENABLED'] = 'true'
os.environ['CAL_DIY_BASE_URL'] = 'https://cal.example.test'
env['ir.config_parameter'].sudo().set_param('emiliany_cal_diy.organizer_id', str(env.ref('base.user_admin').id))

class FakeClient:
    def get_booking(self, uid):
        assert uid == 'isolated-http-test'
        return {'uid': uid, 'status': 'accepted', 'title': 'HTTP test',
                'start': '2026-11-10T10:00:00Z', 'end': '2026-11-10T11:00:00Z',
                'attendees': [{'email': 'http-customer@example.test', 'name': 'Customer'}]}

with patch.object(integration, '_client', return_value=FakeClient()):
    delivery = env['emiliany.cal.delivery'].search([('uid', '=', 'isolated-http-test')])
    assert len(delivery) == 1
    delivery._sync()
    mapping = env['emiliany.cal.booking'].search([('uid', '=', 'isolated-http-test')])
    assert len(mapping) == 1 and mapping.event_id and mapping.partner_id.email == 'http-customer@example.test'
print('HTTP_TO_ODOO_ACCEPTANCE_OK')
env.cr.rollback()
