"""Exercise a running disposable Odoo endpoint; requires CAL_TEST_URL and CAL_TEST_SECRET."""
import datetime
import hashlib
import hmac
import json
import os
import urllib.error
import urllib.request

url = os.environ['CAL_TEST_URL'].rstrip('/') + '/cal-diy/webhook'
secret = os.environ['CAL_TEST_SECRET'].encode()
body = json.dumps({'triggerEvent': 'BOOKING_CREATED',
                   'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                   'payload': {'uid': 'isolated-http-test'}}).encode()
signature = hmac.new(secret, body, hashlib.sha256).hexdigest()


def send(signature):
    req = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json',
                                                            'X-Cal-Signature-256': signature})
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.status
    except urllib.error.HTTPError as exc:
        return exc.code


assert send('0' * 64) == 400
assert send(signature) == 202
assert send(signature) == 202
print('HTTP_ENDPOINT_ACCEPTANCE_OK')
