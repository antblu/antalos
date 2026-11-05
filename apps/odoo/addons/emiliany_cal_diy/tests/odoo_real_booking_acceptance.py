"""Process a real isolated Cal.diy webhook and confirm the calendar booking."""
import os
os.environ['CAL_DIY_SYNC_ENABLED'] = 'true'
uid = os.environ['CAL_TEST_BOOKING_UID']
queue = env['emiliany.cal.delivery']
pending = queue.search([('instance', '=', os.environ['CAL_DIY_BASE_URL']), ('uid', '=', uid), ('state', '=', 'pending')])
assert pending, 'Cal.diy did not deliver the webhook'
queue.cron_process()
booking = env['emiliany.cal.booking'].search([('instance', '=', os.environ['CAL_DIY_BASE_URL']), ('uid', '=', uid)])
assert booking and booking.event_id and booking.event_id.active
assert booking.partner_id.email == 'new-customer@example.test'
assert all(delivery.state == 'done' for delivery in pending)
print('REAL_CAL_DIY_BOOKING_WEBHOOK_OK', booking.event_id.id)
env.cr.commit()
