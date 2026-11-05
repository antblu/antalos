"""Authentication and conservative parsing for Cal.diy's default webhook body.

This module intentionally has no Odoo dependency so the protocol boundary can be
exercised without a database. It does not itself persist or process bookings.
"""
import hashlib
import hmac
import json
import re
from datetime import datetime, timedelta, timezone

MAX_BODY_BYTES = 262144
TRIGGERS = frozenset({
    'BOOKING_CREATED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED',
    'BOOKING_REQUESTED', 'BOOKING_REJECTED',
    'BOOKING_RECONCILE',
})
_HEX_SIGNATURE = re.compile(r'^[0-9a-f]{64}$')


class InvalidWebhook(ValueError):
    """An unauthenticated, stale or malformed delivery."""


def _timestamp(value):
    if not isinstance(value, str) or len(value) > 64:
        raise InvalidWebhook('invalid timestamp')
    try:
        result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError as exc:
        raise InvalidWebhook('invalid timestamp') from exc
    if result.tzinfo is None or result.utcoffset() is None:
        raise InvalidWebhook('timestamp must include an offset')
    return result.astimezone(timezone.utc)


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise InvalidWebhook('duplicate JSON key')
        result[key] = value
    return result


def _invalid_constant(_value):
    raise InvalidWebhook('invalid JSON number')


def parse_webhook(body, signature, secret, *, now=None, max_age=timedelta(days=7)):
    """Verify raw bytes and return a validated envelope and its dedupe digest.

    The signed createdAt limits replay age; retain the digest for at least this
    window. A receiver must persist dedupe and booking changes atomically. A
    timestamp is not a reliable booking revision or a substitute for UID lineage.
    """
    if not isinstance(body, bytes) or not body or len(body) > MAX_BODY_BYTES:
        raise InvalidWebhook('invalid body size')
    if not isinstance(secret, str) or not secret or not isinstance(signature, str):
        raise InvalidWebhook('signature unavailable')
    if not _HEX_SIGNATURE.fullmatch(signature):
        raise InvalidWebhook('invalid signature')
    expected = hmac.new(secret.encode('utf-8'), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise InvalidWebhook('invalid signature')
    try:
        envelope = json.loads(body, object_pairs_hook=_unique_object, parse_constant=_invalid_constant)
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError) as exc:
        raise InvalidWebhook('invalid JSON') from exc
    if (not isinstance(envelope, dict) or not isinstance(envelope.get('triggerEvent'), str)
            or envelope['triggerEvent'] not in TRIGGERS):
        raise InvalidWebhook('unsupported event')
    payload = envelope.get('payload')
    if not isinstance(payload, dict):
        raise InvalidWebhook('invalid payload')
    uid = payload.get('uid')
    if not isinstance(uid, str) or not uid.strip() or len(uid) > 255:
        raise InvalidWebhook('invalid booking UID')
    created = _timestamp(envelope.get('createdAt'))
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError('now must include a timezone')
    if created > now + timedelta(minutes=5) or created < now - max_age:
        raise InvalidWebhook('delivery timestamp outside acceptance window')
    return envelope, hashlib.sha256(body).hexdigest()


def booking_interval(payload):
    """Convert Cal.diy ISO timestamps to naive UTC datetimes for Odoo ORM."""
    start = _timestamp(payload.get('startTime'))
    end = _timestamp(payload.get('endTime'))
    if end <= start:
        raise InvalidWebhook('invalid booking interval')
    return start.replace(tzinfo=None), end.replace(tzinfo=None)
