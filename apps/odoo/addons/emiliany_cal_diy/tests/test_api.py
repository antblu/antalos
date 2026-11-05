import importlib.util
import io
import json
import unittest
from pathlib import Path
from urllib.error import HTTPError, URLError

spec = importlib.util.spec_from_file_location('cal_api', Path(__file__).parents[1] / 'services' / 'api.py')
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)


class Response:
    def __init__(self, obj):
        self.obj = obj
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def read(self, size):
        return json.dumps(self.obj).encode()


class Opener:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []
    def open(self, request, timeout):
        self.calls.append((request, timeout))
        result = self.responses.pop(0)
        if isinstance(result, Exception):
            raise result
        return Response(result)


class ApiTests(unittest.TestCase):
    def test_versioned_self_hosted_request_and_pagination(self):
        opener = Opener([{'status': 'success', 'data': [], 'pagination': {}}])
        client = api.CalApi('https://cal.example', 'private-key', opener=opener)
        client.get_bookings_page(skip=10, take=20, updated_after='2026-01-01T00:00:00Z')
        request, timeout = opener.calls[0]
        self.assertIn('/api/v2/bookings?', request.full_url)
        self.assertIn('skip=10', request.full_url)
        self.assertEqual(request.get_header('Cal-api-version'), '2024-08-13')
        self.assertEqual(timeout, 10)

    def test_retries_temporary_failure_without_leaking_key(self):
        delays = []
        opener = Opener([URLError('private-key'), {'status': 'success', 'data': {'uid': 'abc'}}])
        client = api.CalApi('https://cal.example', 'private-key', opener=opener, sleep=delays.append)
        self.assertEqual(client.get_booking('abc')['uid'], 'abc')
        self.assertEqual(len(delays), 1)

    def test_rate_limit_respects_retry_after(self):
        delays = []
        error = HTTPError('https://cal.example', 429, 'rate limit', {'Retry-After': '3'}, io.BytesIO())
        opener = Opener([error, {'status': 'success', 'data': []}])
        api.CalApi('https://cal.example', 'private-key', opener=opener, sleep=delays.append).get_bookings_page()
        self.assertEqual(delays, [3])

    def test_unauthorized_fails_without_retry_or_secret_in_error(self):
        error = HTTPError('https://cal.example', 401, 'private-key', {}, io.BytesIO())
        opener = Opener([error])
        with self.assertRaises(api.CalApiError) as caught:
            api.CalApi('https://cal.example', 'private-key', opener=opener).get_booking('abc')
        self.assertNotIn('private-key', str(caught.exception))
        self.assertEqual(len(opener.calls), 1)

    def test_rejects_unsafe_origins(self):
        for origin in ['http://example.com', 'https://user:pass@example.com', 'https://example.com/path']:
            with self.subTest(origin=origin), self.assertRaises(ValueError):
                api.CalApi(origin, 'private-key')


if __name__ == '__main__':
    unittest.main()
