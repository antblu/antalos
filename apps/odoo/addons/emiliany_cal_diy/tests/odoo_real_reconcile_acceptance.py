"""Reconcile a seeded booking from the real isolated Cal.diy API."""
import os
os.environ['CAL_DIY_SYNC_ENABLED'] = 'true'
queue = env['emiliany.cal.delivery']
queue.cron_reconcile()
deliveries = queue.search([('instance', '=', os.environ['CAL_DIY_BASE_URL']),
                           ('uid', '=', 'real-api-test-uid'), ('digest', '=like', 'reconcile:%')])
assert deliveries, 'Real Cal.diy API booking was not found by reconciliation'
queue.cron_process()
assert all(delivery.state == 'done' for delivery in deliveries)
print('REAL_CAL_DIY_RECONCILIATION_OK')
env.cr.rollback()
