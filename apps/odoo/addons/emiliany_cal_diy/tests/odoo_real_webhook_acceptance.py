"""After cancelling a seeded booking through the real isolated Cal.diy API."""
import os
os.environ['CAL_DIY_SYNC_ENABLED'] = 'true'
uid = os.environ.get('CAL_TEST_BOOKING_UID', 'real-api-test-uid')
queue = env['emiliany.cal.delivery']
pending = queue.search([('instance', '=', os.environ['CAL_DIY_BASE_URL']),
                        ('uid', '=', uid), ('state', '=', 'pending')])
assert pending, 'Real Cal.diy cancellation webhook was not queued'
queue.cron_process()
booking = env['emiliany.cal.booking'].search([('instance', '=', os.environ['CAL_DIY_BASE_URL']),
                                               ('uid', '=', uid)])
assert booking.status == 'cancelled'
assert booking.event_id and not booking.event_id.active
assert all(delivery.state == 'done' for delivery in pending)
print('REAL_CAL_DIY_WEBHOOK_TO_ODOO_OK')
env.cr.rollback()
