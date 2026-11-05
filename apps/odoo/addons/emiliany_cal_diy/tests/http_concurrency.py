"""Send identical signed deliveries concurrently to a disposable Odoo server."""
import concurrent.futures
import datetime
import hashlib
import hmac
import json
import os
import urllib.request

url = os.environ['CAL_TEST_URL'].rstrip('/') + '/cal-diy/webhook'
secret = os.environ['CAL_TEST_SECRET'].encode()
body = json.dumps({'triggerEvent': 'BOOKING_CREATED',
                   'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                   'payload': {'uid': 'isolated-concurrent-test'}}).encode()
signature = hmac.new(secret, body, hashlib.sha256).hexdigest()


def send(_):
    req = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json',
                                                            'X-Cal-Signature-256': signature})
    with urllib.request.urlopen(req, timeout=20) as response:
        return response.status


with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
    statuses = list(pool.map(send, range(24)))
assert statuses == [202] * 24, statuses
print('CONCURRENT_WEBHOOKS_OK')
