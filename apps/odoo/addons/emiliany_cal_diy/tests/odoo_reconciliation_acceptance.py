"""Check pagination progress past 10,000 entries and retry in a disposable DB."""
import os
from unittest.mock import patch
from odoo.addons.emiliany_cal_diy.models import integration
from odoo.addons.emiliany_cal_diy.services.api import CalApiError

os.environ['CAL_DIY_SYNC_ENABLED'] = 'true'
os.environ['CAL_DIY_BASE_URL'] = 'https://reconcile.example.test'

class FakeClient:
    fail = False
    def get_bookings_page(self, *, skip, take):
        if self.fail:
            raise CalApiError('simulated outage')
        return {'data': [{'uid': 'bulk-%s' % i, 'updatedAt': '2026-01-01T00:00:00Z'}
                         for i in range(skip, min(skip + take, 10105))]}

client = FakeClient()
with patch.object(integration, '_client', return_value=client):
    queue = env['emiliany.cal.delivery']
    queue.cron_reconcile()
    state = env['emiliany.cal.reconciliation'].search([('instance', '=', 'https://reconcile.example.test')])
    assert state.next_offset == 300
    client.fail = True
    queue.cron_reconcile()
    assert state.next_offset == 300
    client.fail = False
    for _ in range(34):
        queue.cron_reconcile()
        if state.completed_at:
            break
    assert state.completed_at and state.next_offset == 0
    assert queue.search_count([('instance', '=', 'https://reconcile.example.test')]) == 10105
    queue.cron_reconcile()
    assert queue.search_count([('instance', '=', 'https://reconcile.example.test')]) == 10105
# A booking displaced across an offset boundary is recovered by a later scan.
os.environ['CAL_DIY_BASE_URL'] = 'https://moving.example.test'
class MovingClient:
    def __init__(self):
        self.items = list(range(200))
        self.calls = 0
    def get_bookings_page(self, *, skip, take):
        self.calls += 1
        if self.calls == 2:
            self.items.pop(0)
        return {'data': [{'uid': 'moving-%s' % i} for i in self.items[skip:skip + take]]}

with patch.object(integration, '_client', return_value=MovingClient()):
    queue.cron_reconcile()
    assert not queue.search([('instance', '=', 'https://moving.example.test'), ('uid', '=', 'moving-100')])
    queue.cron_reconcile()
    assert queue.search([('instance', '=', 'https://moving.example.test'), ('uid', '=', 'moving-100')])
print('RECONCILIATION_ACCEPTANCE_OK')
env.cr.rollback()
