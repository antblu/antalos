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
                         for i in range(skip, min(skip + take, 10105))], 'pagination': {'totalItems': 10105}}

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
        return {'data': [{'uid': 'moving-%s' % i} for i in self.items[skip:skip + take]], 'pagination': {'totalItems': len(self.items)}}

with patch.object(integration, '_client', return_value=MovingClient()):
    queue.cron_reconcile()
    assert not queue.search([('instance', '=', 'https://moving.example.test'), ('uid', '=', 'moving-100')])
    state = env['emiliany.cal.reconciliation'].search([('instance', '=', 'https://moving.example.test')])
    assert not state.completed_at and state.last_error
    queue.cron_reconcile()
    assert queue.search([('instance', '=', 'https://moving.example.test'), ('uid', '=', 'moving-100')])
    assert state.completed_at and not state.last_error
# A duplicate boundary with an unchanged total must not be marked successful.
os.environ['CAL_DIY_BASE_URL'] = 'https://duplicate-page.example.test'
class DuplicateBoundaryClient:
    def __init__(self):
        self.unstable = True
    def get_bookings_page(self, *, skip, take):
        if self.unstable and skip == 100:
            numbers = list(range(99, 199))
        else:
            numbers = list(range(skip, min(skip + take, 200)))
        return {'data': [{'uid': 'tie-%s' % i} for i in numbers], 'pagination': {'totalItems': 200}}

client = DuplicateBoundaryClient()
with patch.object(integration, '_client', return_value=client):
    queue.cron_reconcile()
    state = env['emiliany.cal.reconciliation'].search([('instance', '=', 'https://duplicate-page.example.test')])
    assert state.last_error and not state.completed_at
    client.unstable = False
    queue.cron_reconcile()
    assert state.completed_at and not state.last_error
    assert queue.search_count([('instance', '=', 'https://duplicate-page.example.test')]) == 200
print('RECONCILIATION_ACCEPTANCE_OK')
env.cr.rollback()
