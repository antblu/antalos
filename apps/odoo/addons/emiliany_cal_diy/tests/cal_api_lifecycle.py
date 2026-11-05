"""Run a real API -> signed webhook -> Odoo lifecycle in a disposable setup.

Requires an isolated API with event type 1001, a registered signed webhook, an
Odoo server receiving it, an initialized Odoo test database, and the environment
variables listed below. This script creates and cancels a real test booking.
"""
import json
import os
import re
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen

api_url = os.environ['CAL_TEST_API_URL'].rstrip('/')
api_key = os.environ['CAL_DIY_API_KEY']
network = os.environ['CAL_TEST_NETWORK']
tls_dir = os.environ['CAL_TEST_TLS_DIR']
base_url = os.environ['CAL_DIY_BASE_URL']
db_host = os.environ['CAL_TEST_ODOO_DB_HOST']
addon_dir = Path(__file__).resolve().parents[2]
test_dir = Path(__file__).resolve().parent


def post(path, payload):
    request = Request(api_url + '/api/v2/' + path, data=json.dumps(payload).encode(),
                      headers={'Authorization': 'Bearer ' + api_key, 'Content-Type': 'application/json',
                               'cal-api-version': '2024-08-13'})
    with urlopen(request, timeout=30) as response:
        result = json.load(response)
    assert result['status'] == 'success'
    return result['data']


def run_odoo(script, uid):
    command = ['docker', 'run', '--rm', '-i', '--network', network,
               '-e', 'CAL_DIY_BASE_URL=' + base_url, '-e', 'CAL_DIY_API_KEY=' + api_key,
               '-e', 'CAL_TEST_BOOKING_UID=' + uid, '-e', 'SSL_CERT_FILE=/tls/cert.pem',
               '--entrypoint', 'odoo', '-v', tls_dir + ':/tls:ro', '-v', str(addon_dir) + ':/mnt/extra-addons:ro',
               'odoo:19.0', 'shell', '-d', 'cal_test', '--db_host=' + db_host, '--db_user=caltest',
               '--db_password=caltest-only', '--addons-path=/usr/lib/python3/dist-packages/odoo/addons,/mnt/extra-addons',
               '--no-http', '--log-level=error']
    result = subprocess.run(command, input=(test_dir / script).read_text(), text=True, capture_output=True, check=True)
    return result.stdout


start = (datetime.now(timezone.utc) + timedelta(days=4)).replace(hour=12, minute=0, second=0, microsecond=0)
created = post('bookings', {'eventTypeId': 1001, 'start': start.isoformat(),
                            'attendee': {'name': 'Test Customer', 'email': 'new-customer@example.test',
                                         'timeZone': 'America/Denver'}})
first_uid = created['uid']
first = run_odoo('odoo_real_booking_acceptance.py', first_uid)
first_id = re.search(r'REAL_CAL_DIY_BOOKING_WEBHOOK_OK (\d+)', first)
assert first_id, first
rescheduled = post('bookings/' + first_uid + '/reschedule', {'start': (start + timedelta(days=1)).isoformat()})
second_uid = rescheduled['uid']
second = run_odoo('odoo_real_booking_acceptance.py', second_uid)
second_id = re.search(r'REAL_CAL_DIY_BOOKING_WEBHOOK_OK (\d+)', second)
assert second_id and first_id.group(1) == second_id.group(1), second
post('bookings/' + second_uid + '/cancel', {'cancellationReason': 'Isolated integration test'})
assert 'REAL_CAL_DIY_WEBHOOK_TO_ODOO_OK' in run_odoo('odoo_real_webhook_acceptance.py', second_uid)
print('REAL_CAL_DIY_LIFECYCLE_OK')
