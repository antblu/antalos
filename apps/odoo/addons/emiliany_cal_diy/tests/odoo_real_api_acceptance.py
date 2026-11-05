"""Exercise a seeded real Cal.diy API booking against a disposable Odoo database.

Set CAL_DIY_BASE_URL, CAL_DIY_API_KEY and SSL_CERT_FILE for the isolated server.
This does not prove Cal.diy itself emitted a webhook or created the booking.
"""
import os

os.environ['CAL_DIY_SYNC_ENABLED'] = 'true'
env['ir.config_parameter'].sudo().set_param('emiliany_cal_diy.organizer_id', str(env.ref('base.user_admin').id))
queue = env['emiliany.cal.delivery']
queue.receive('real-api-seeded-booking', 'real-api-test-uid')
queue.cron_process()
delivery = queue.search([('instance', '=', os.environ['CAL_DIY_BASE_URL']), ('uid', '=', 'real-api-test-uid')])
assert delivery.state == 'done', (delivery.state, delivery.error)
booking = env['emiliany.cal.booking'].search([('instance', '=', os.environ['CAL_DIY_BASE_URL']), ('uid', '=', 'real-api-test-uid')])
assert booking.event_id and booking.partner_id.email == 'customer@example.test'
assert booking.event_id.start.strftime('%Y-%m-%d %H:%M') == '2026-11-10 10:00'
print('REAL_CAL_DIY_API_TO_ODOO_OK')
env.cr.rollback()
