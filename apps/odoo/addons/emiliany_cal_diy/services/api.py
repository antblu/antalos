"""Read-only client for the deployed Cal.diy API v2 booking endpoints.

This is a protocol component, not a reconciliation job. Callers must persist
checkpoints only after their complete batch has committed successfully.
"""
import json
import random
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


class CalApiError(Exception):
    """A deliberately sanitized error suitable for administrator diagnostics."""

    def __init__(self, message, *, status_code=None):
        super().__init__(message)
        self.status_code = status_code


class _RejectRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class CalApi:
    def __init__(self, base_url, api_key, *, timeout=10, retries=3, opener=None, sleep=time.sleep):
        parsed = urlsplit(base_url)
        if (parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password
                or parsed.query or parsed.fragment or parsed.path not in ('', '/')):
            raise ValueError('base URL must be an HTTPS origin')
        if not isinstance(api_key, str) or not api_key.strip() or '\n' in api_key or '\r' in api_key:
            raise ValueError('API key required')
        if not 0 < timeout <= 60 or not 0 <= retries <= 5:
            raise ValueError('invalid timeout or retry count')
        self._origin = urlunsplit((parsed.scheme, parsed.netloc, '', '', ''))
        self._key = api_key
        self._timeout = timeout
        self._retries = retries
        self._opener = opener or build_opener(_RejectRedirects())
        self._sleep = sleep

    def _get(self, path, query=None):
        url = self._origin + '/api/v2/' + path
        if query:
            url += '?' + urlencode(query)
        request = Request(url, headers={'Authorization': 'Bearer ' + self._key,
                                        'cal-api-version': '2024-08-13',
                                        'Accept': 'application/json'})
        for attempt in range(self._retries + 1):
            retry_after = None
            try:
                with self._opener.open(request, timeout=self._timeout) as response:
                    raw = response.read(4 * 1024 * 1024 + 1)
                if len(raw) > 4 * 1024 * 1024:
                    raise CalApiError('Cal.diy response exceeded size limit')
                result = json.loads(raw)
                if not isinstance(result, dict) or result.get('status') != 'success' or 'data' not in result:
                    raise CalApiError('Cal.diy returned an invalid response')
                return result
            except HTTPError as exc:
                if exc.code != 429 and not 500 <= exc.code <= 599:
                    raise CalApiError('Cal.diy API rejected the request (HTTP %s)' % exc.code, status_code=exc.code) from None
                if exc.code == 429:
                    try:
                        retry_after = max(0, min(60, int(exc.headers.get('Retry-After', ''))))
                    except (TypeError, ValueError):
                        pass
            except (URLError, TimeoutError):
                pass
            except (ValueError, UnicodeDecodeError):
                raise CalApiError('Cal.diy returned invalid JSON') from None
            if attempt == self._retries:
                raise CalApiError('Cal.diy API is temporarily unavailable') from None
            delay = retry_after if retry_after is not None else min(30, 2 ** attempt + random.random())
            self._sleep(delay)
        raise CalApiError('Cal.diy API is temporarily unavailable')

    def get_booking(self, uid):
        if not isinstance(uid, str) or not uid or len(uid) > 255 or '/' in uid:
            raise ValueError('invalid booking UID')
        return self._get('bookings/' + quote(uid, safe=''))['data']

    def get_bookings_page(self, *, skip=0, take=100, updated_after=None):
        if not isinstance(skip, int) or skip < 0 or not isinstance(take, int) or not 1 <= take <= 250:
            raise ValueError('invalid pagination')
        query = {'skip': skip, 'take': take, 'sortUpdatedAt': 'asc'}
        if updated_after:
            query['afterUpdatedAt'] = updated_after
        result = self._get('bookings', query)
        if not isinstance(result['data'], list):
            raise CalApiError('Cal.diy returned invalid booking data')
        return result
