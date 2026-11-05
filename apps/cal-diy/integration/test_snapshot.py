"""Run against a disposable PostgreSQL database using SNAPSHOT_TEST_DSN."""
import io
import json
import os
import unittest
from contextlib import closing
from unittest.mock import MagicMock

import psycopg2

from snapshot import capture, deliver


class SnapshotTests(unittest.TestCase):
    def test_capture_survives_concurrent_changes(self):
        dsn = os.environ['SNAPSHOT_TEST_DSN']
        with psycopg2.connect(dsn) as setup:
            with setup.cursor() as cursor:
                cursor.execute('CREATE TABLE "Booking" (id integer PRIMARY KEY, uid text, "userId" integer)')
                cursor.execute('INSERT INTO "Booking" SELECT i, i::text, 1 FROM generate_series(1, 10105) i')
                cursor.execute('INSERT INTO "Booking" VALUES (10106, \'other-owner\', 2)')
        output = io.StringIO()
        changed = False

        class MovingDestination:
            def write(self, line):
                nonlocal changed
                if not changed:
                    with psycopg2.connect(dsn) as writer:
                        with writer.cursor() as cursor:
                            cursor.execute('DELETE FROM "Booking" WHERE id = 10000')
                            cursor.execute('INSERT INTO "Booking" VALUES (20000, \'new-booking\', 1)')
                    changed = True
                return output.write(line)

            def seek(self, offset):
                output.seek(offset)

        with closing(psycopg2.connect(dsn)) as reader:
            self.assertEqual(capture(reader, [1], MovingDestination()), 10105)
            with self.assertRaises(psycopg2.errors.ReadOnlySqlTransaction):
                with reader.cursor() as cursor:
                    cursor.execute('INSERT INTO "Booking" VALUES (30000, \'forbidden\', 1)')
        self.assertEqual([json.loads(line) for line in output], [str(i) for i in range(1, 10106)])

    def test_delivery_signature_and_failure(self):
        import hashlib
        import hmac
        opener = MagicMock()
        opener.open.return_value.__enter__.return_value.status = 202
        self.assertEqual(deliver(io.StringIO('"booking-1"\n'), 'https://odoo.example/webhook', 'secret', opener), 1)
        request = opener.open.call_args.args[0]
        self.assertEqual(request.get_header('X-cal-signature-256'),
                         hmac.new(b'secret', request.data, hashlib.sha256).hexdigest())
        self.assertEqual(json.loads(request.data)['payload']['uid'], 'booking-1')
        opener.open.return_value.__enter__.return_value.status = 200
        with self.assertRaises(RuntimeError):
            deliver(io.StringIO('"booking-1"\n'), 'https://odoo.example/webhook', 'secret', opener)


if __name__ == '__main__':
    unittest.main()
