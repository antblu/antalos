"""Run with odoo shell against a disposable database; all changes roll back."""
import os
from unittest.mock import patch

from odoo.addons.emiliany_cal_diy.models import integration

os.environ['CAL_DIY_SYNC_ENABLED'] = 'true'
os.environ['CAL_DIY_BASE_URL'] = 'https://cal.example.test'
env['ir.config_parameter'].sudo().set_param('emiliany_cal_diy.organizer_id', str(env.ref('base.user_admin').id))
booking = {'uid': 'first', 'status': 'accepted', 'title': 'Consultation',
           'start': '2026-11-01T01:30:00-06:00', 'end': '2026-11-01T01:30:00-07:00',
           'attendees': [{'email': 'CUSTOMER@example.test', 'name': 'Customer'}], 'eventType': {'id': 1}}
partner = env['res.partner'].create({'name': 'Existing', 'email': 'customer@example.test'})
lead = env['crm.lead'].create({'name': 'Existing opportunity', 'partner_id': partner.id, 'type': 'opportunity'})
current = {'first': booking}

class FakeClient:
    def get_booking(self, uid):
        return current[uid]
    def get_bookings_page(self, **kwargs):
        return {'data': list(current.values())}

with patch.object(integration, '_client', return_value=FakeClient()):
    queue = env['emiliany.cal.delivery']
    queue.receive('one', 'first')
    queue.receive('one', 'first')
    assert queue.search_count([('digest', '=', 'one')]) == 1
    queue.cron_process()
    mapping = env['emiliany.cal.booking'].search([('uid', '=', 'first')])
    assert len(mapping) == 1 and mapping.partner_id == partner and mapping.opportunity_id == lead
    assert mapping.event_id.start.strftime('%Y-%m-%d %H:%M') == '2026-11-01 07:30'
    event_id = mapping.event_id.id
    second = dict(booking, uid='second', rescheduledFromUid='first', start='2026-11-03T10:00:00Z', end='2026-11-03T11:00:00Z')
    current['first'] = dict(booking, status='cancelled', rescheduledToUid='second')
    current['second'] = second
    queue.receive('two', 'second')
    queue.cron_process()
    assert mapping.uid == 'second' and mapping.event_id.id == event_id
    queue.receive('late-first', 'first')
    queue.cron_process()
    assert mapping.uid == 'second' and mapping.event_id.active
    current['second'] = dict(second, status='cancelled')
    queue.receive('cancel', 'second')
    queue.cron_process()
    assert mapping.status == 'cancelled' and not mapping.event_id.active
    queue.receive('late-create', 'first')
    queue.cron_process()
    assert mapping.status == 'cancelled' and not mapping.event_id.active
    queue.receive('temporary-failure', 'missing')
    queue.cron_process()
    failure = queue.search([('digest', '=', 'temporary-failure')])
    assert failure.state == 'pending' and failure.attempts == 1 and failure.next_attempt
    failure.write({'attempts': 12, 'next_attempt': False})
    queue.cron_process()
    assert failure.state == 'pending' and failure.attempts == 13
    current['missing'] = dict(second, uid='missing', status='accepted', rescheduledFromUid='second')
    failure.action_retry()
    queue.cron_process()
    assert failure.state == 'done' and mapping.uid == 'missing'
    current.pop('missing')
    queue.cron_reconcile()
    queue.cron_process()
    assert env['emiliany.cal.booking'].search_count([]) == 1
    assert env['res.partner'].search_count([('email', '=ilike', 'customer@example.test')]) == 1
    env['emiliany.cal.event.type'].create({'event_type_id': 2, 'organizer_id': env.ref('base.user_admin').id, 'create_opportunity': True})
    multi = dict(booking, uid='multi', eventType={'id': 2}, attendees=[
        {'email': 'NEW@example.test'}, {'email': 'new@example.test'}, {'email': 'other@example.test', 'name': 'Other'}])
    current['multi'] = multi
    queue.receive('multi', 'multi')
    queue.cron_process()
    multi_record = env['emiliany.cal.booking'].search([('uid', '=', 'multi')])
    assert len(multi_record.event_id.partner_ids) == 2 and multi_record.opportunity_id
    assert env['res.partner'].search_count([('email', '=ilike', 'new@example.test')]) == 1
print('CAL_ODOO_ACCEPTANCE_OK')
env.cr.rollback()
