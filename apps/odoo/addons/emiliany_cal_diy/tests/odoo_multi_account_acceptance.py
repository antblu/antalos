"""Exercise account-scoped reconciliation and booking lookup in a disposable Odoo DB."""
import os
from unittest.mock import patch
from odoo.addons.emiliany_cal_diy.models import integration
from odoo.addons.emiliany_cal_diy.services.api import CalApiError

os.environ['CAL_DIY_SYNC_ENABLED'] = 'true'
os.environ['CAL_DIY_BASE_URL'] = 'https://multi-account.example.test'
os.environ['CAL_DIY_API_KEYS'] = 'key-a\nkey-b'
env['ir.config_parameter'].sudo().set_param('emiliany_cal_diy.organizer_id', str(env.ref('base.user_admin').id))

class FakeClient:
    def __init__(self, key):
        self.key = key
    def get_bookings_page(self, *, skip, take):
        return {'data': [{'uid': 'booking-' + self.key}] if skip == 0 else [], 'pagination': {'totalItems': 1}}
    def get_booking(self, uid):
        if uid != 'booking-' + self.key:
            raise CalApiError('Not visible', status_code=404)
        return {'uid': uid, 'status': 'accepted', 'title': 'Consultation',
                'start': '2026-11-11T10:00:00Z', 'end': '2026-11-11T11:00:00Z',
                'attendees': [{'email': self.key + '@example.test', 'name': self.key}]}

with patch.object(integration, '_client', side_effect=lambda key=None: FakeClient(key)):
    queue = env['emiliany.cal.delivery']
    queue.cron_reconcile()
    checkpoints = env['emiliany.cal.reconciliation'].search([('instance', '=', 'https://multi-account.example.test')])
    assert len(checkpoints) == 2
    assert set(checkpoints.mapped('account')) == {integration._account_identifier('key-a'), integration._account_identifier('key-b')}
    queue.cron_process()
    assert env['emiliany.cal.booking'].search_count([('instance', '=', 'https://multi-account.example.test')]) == 2
    assert queue.search_count([('instance', '=', 'https://multi-account.example.test'), ('state', '=', 'done')]) == 2
print('MULTI_ACCOUNT_ACCEPTANCE_OK')
env.cr.rollback()
