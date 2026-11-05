import hashlib
import hmac
import importlib.util
import json
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

spec = importlib.util.spec_from_file_location('cal_webhook', Path(__file__).parents[1] / 'services' / 'webhook.py')
webhook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(webhook)


class WebhookTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 1, 12, tzinfo=timezone.utc)
        self.event = {'triggerEvent': 'BOOKING_CREATED', 'createdAt': self.now.isoformat(),
                      'payload': {'uid': 'booking-1', 'startTime': '2026-11-01T01:30:00-06:00',
                                  'endTime': '2026-11-01T01:30:00-07:00'}}

    def check(self, obj=None, secret='secret', signature=None, now=None):
        body = json.dumps(self.event if obj is None else obj).encode()
        sig = signature if signature is not None else hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        return webhook.parse_webhook(body, sig, secret, now=now or self.now)

    def test_valid_deduplication_digest_is_stable(self):
        first = self.check()
        self.assertEqual(first, self.check())
        self.assertEqual(first[0]['payload']['uid'], 'booking-1')

    def test_invalid_signatures_and_missing_secret(self):
        for signature, secret in [('0' * 64, 'secret'), ('no-secret-provided', 'secret'), ('a' * 64, '')]:
            with self.subTest(signature=signature), self.assertRaises(webhook.InvalidWebhook):
                self.check(secret=secret, signature=signature)

    def test_tampered_payload_rejected(self):
        body = json.dumps(self.event).encode()
        signature = hmac.new(b'secret', body, hashlib.sha256).hexdigest()
        with self.assertRaises(webhook.InvalidWebhook):
            webhook.parse_webhook(body + b' ', signature, 'secret', now=self.now)

    def test_malformed_or_unsupported_envelope(self):
        for obj in [[], {}, {'triggerEvent': 'OTHER'}, {'triggerEvent': 'BOOKING_CREATED', 'payload': {}},
                    dict(self.event, payload={'uid': ''})]:
            with self.subTest(obj=obj), self.assertRaises(webhook.InvalidWebhook):
                self.check(obj)

    def test_replay_window_and_future_skew(self):
        for delta in [timedelta(days=8), -timedelta(minutes=6)]:
            with self.subTest(delta=delta), self.assertRaises(webhook.InvalidWebhook):
                self.check(now=self.now + delta)

    def test_dst_fold_keeps_correct_utc_interval(self):
        start, end = webhook.booking_interval(self.event['payload'])
        self.assertEqual(start, datetime(2026, 11, 1, 7, 30))
        self.assertEqual(end, datetime(2026, 11, 1, 8, 30))

    def test_missing_offsets_and_reversed_interval_rejected(self):
        for payload in [{'startTime': '2026-01-01T10:00:00', 'endTime': '2026-01-01T11:00:00Z'},
                        {'startTime': '2026-01-01T11:00:00Z', 'endTime': '2026-01-01T10:00:00Z'}]:
            with self.subTest(payload=payload), self.assertRaises(webhook.InvalidWebhook):
                webhook.booking_interval(payload)


if __name__ == '__main__':
    unittest.main()
