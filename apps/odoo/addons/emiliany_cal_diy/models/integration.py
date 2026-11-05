import hashlib
import html
import logging
import os

from datetime import timedelta

from odoo import api, fields, models
from odoo.exceptions import UserError

from ..services.api import CalApi, CalApiError
from ..services.webhook import booking_interval

_logger = logging.getLogger(__name__)


def _enabled():
    return os.environ.get('CAL_DIY_SYNC_ENABLED', '').lower() == 'true'


def _client():
    return CalApi(os.environ.get('CAL_DIY_BASE_URL', ''), os.environ.get('CAL_DIY_API_KEY', ''), timeout=10, retries=2)


def _instance():
    return os.environ.get('CAL_DIY_BASE_URL', '').rstrip('/')


class CalBooking(models.Model):
    _name = 'emiliany.cal.booking'
    _description = 'Cal.diy booking synchronization'
    _rec_name = 'uid'
    _order = 'id desc'

    instance = fields.Char(required=True, readonly=True, index=True)
    uid = fields.Char(required=True, readonly=True, index=True)
    event_id = fields.Many2one('calendar.event', readonly=True, ondelete='set null')
    partner_id = fields.Many2one('res.partner', readonly=True, ondelete='set null')
    opportunity_id = fields.Many2one('crm.lead', readonly=True, ondelete='set null')
    status = fields.Char(readonly=True)
    event_type = fields.Char(readonly=True)
    synced_at = fields.Datetime(readonly=True)
    error = fields.Char(readonly=True)
    external_updated_at = fields.Char(readonly=True)

    _uid_unique = models.Constraint('UNIQUE(instance, uid)', 'The booking UID must be unique per instance.')


class CalEventType(models.Model):
    _name = 'emiliany.cal.event.type'
    _description = 'Cal.diy event type mapping'
    _rec_name = 'event_type_id'

    event_type_id = fields.Integer(required=True, index=True)
    organizer_id = fields.Many2one('res.users', required=True, domain=[('share', '=', False), ('active', '=', True)])
    create_opportunity = fields.Boolean(default=False)
    _event_type_unique = models.Constraint('UNIQUE(event_type_id)', 'An event type can only have one mapping.')


class CalAlias(models.Model):
    _name = 'emiliany.cal.alias'
    _description = 'Cal.diy booking UID lineage'

    instance = fields.Char(required=True, index=True)
    uid = fields.Char(required=True, index=True)
    booking_id = fields.Many2one('emiliany.cal.booking', required=True, ondelete='cascade', index=True)
    _uid_unique = models.Constraint('UNIQUE(instance, uid)', 'The booking UID must be unique per instance.')


class CalReconciliation(models.Model):
    _name = 'emiliany.cal.reconciliation'
    _description = 'Cal.diy reconciliation scan progress'

    instance = fields.Char(required=True, index=True)
    next_offset = fields.Integer(default=0, required=True)
    completed_at = fields.Datetime(readonly=True)
    _instance_unique = models.Constraint('UNIQUE(instance)', 'Only one reconciliation scan per instance is allowed.')


class CalDelivery(models.Model):
    _name = 'emiliany.cal.delivery'
    _description = 'Cal.diy delivery and synchronization queue'
    _order = 'id'
    _rec_name = 'uid'

    digest = fields.Char(required=True, readonly=True, index=True)
    instance = fields.Char(required=True, readonly=True, index=True)
    uid = fields.Char(required=True, readonly=True, index=True)
    state = fields.Selection([('pending', 'Pending'), ('done', 'Done'), ('failed', 'Failed')], default='pending', required=True, index=True)
    attempts = fields.Integer(default=0)
    next_attempt = fields.Datetime(index=True)
    error = fields.Char(readonly=True)
    _delivery_unique = models.Constraint('UNIQUE(instance, digest)', 'The delivery has already been received.')

    @api.model
    def receive(self, digest, uid):
        self._insert_delivery(self.env.cr, digest, uid)

    @api.model
    def receive_http(self, digest, uid):
        # A fresh READ COMMITTED transaction makes ON CONFLICT safe when Odoo's
        # HTTP request transaction uses REPEATABLE READ. The independently
        # committed inbox row makes retrying a lost HTTP response safe.
        with self.env.registry.cursor() as cr:
            cr.execute('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')
            self._insert_delivery(cr, digest, uid)

    @api.model
    def _insert_delivery(self, cr, digest, uid):
        # PostgreSQL arbitrates concurrent deliveries without an exception that
        # would cause Odoo to log the query and its customer booking identifier.
        # This is the only direct insert; processing and relations use the ORM.
        cr.execute("""
            INSERT INTO emiliany_cal_delivery
                (digest, instance, uid, state, attempts, create_uid, write_uid, create_date, write_date)
            VALUES (%s, %s, %s, 'pending', 0, %s, %s, now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC')
            ON CONFLICT (instance, digest) DO NOTHING
        """, [digest, _instance(), uid, self.env.uid, self.env.uid])

    def action_retry(self):
        self.write({'state': 'pending', 'attempts': 0, 'next_attempt': False, 'error': False})

    @api.model
    def cron_process(self):
        if not _enabled():
            return
        # Never make webhook ingestion wait for a slow API request. Serialize
        # only processors; competing cron workers return immediately.
        self.env.cr.execute('SELECT pg_try_advisory_xact_lock(%s)', [174091401])
        if not self.env.cr.fetchone()[0]:
            return
        for delivery in self.search([('instance', '=', _instance()), ('state', '=', 'pending'), '|',
                                     ('next_attempt', '=', False), ('next_attempt', '<=', fields.Datetime.now())], limit=30):
            delivery.invalidate_recordset(['state'])
            if delivery.state != 'pending':
                continue
            try:
                with self.env.cr.savepoint():
                    delivery._sync()
            except Exception:
                # Do not log API responses, identifiers, contacts or exception text.
                _logger.warning('Cal.diy synchronization failed; delivery will be retried')
                attempts = delivery.attempts + 1
                delivery.write({'attempts': attempts, 'state': 'pending',
                                'next_attempt': fields.Datetime.now() + timedelta(minutes=min(360, 2 ** min(attempts, 8))),
                                'error': 'Synchronization failed; check configuration and API access.'})
            else:
                delivery.write({'state': 'done', 'error': False, 'next_attempt': False})

    def _sync(self):
        self.ensure_one()
        client = _client()
        booking = client.get_booking(self.uid)
        visited = set()
        while isinstance(booking, dict) and booking.get('rescheduledToUid'):
            uid = booking['uid']
            if uid in visited or len(visited) >= 20:
                raise UserError('Invalid booking lineage')
            visited.add(uid)
            booking = client.get_booking(booking['rescheduledToUid'])
        if not isinstance(booking, dict):
            raise UserError('Unsupported booking response')
        self.env['emiliany.cal.booking']._apply_booking(booking, visited)

    @api.model
    def cron_reconcile(self):
        if not _enabled():
            return
        # Bound each invocation while retaining progress across invocations.
        # Repeated full scans recover records displaced by concurrent updates
        # during offset pagination, provided the visible dataset settles.
        self.env.cr.execute('SELECT pg_try_advisory_xact_lock(%s)', [174091402])
        if not self.env.cr.fetchone()[0]:
            return
        try:
            client = _client()
        except ValueError:
            _logger.warning('Cal.diy reconciliation configuration is invalid')
            return
        state_model = self.env['emiliany.cal.reconciliation']
        state = state_model.search([('instance', '=', _instance())], limit=1)
        if not state:
            state = state_model.create({'instance': _instance()})
        for _page in range(3):
            try:
                result = client.get_bookings_page(skip=state.next_offset, take=100)
            except (CalApiError, ValueError):
                _logger.warning('Cal.diy reconciliation failed; next scheduled run will retry')
                return
            for item in result['data']:
                if not isinstance(item, dict) or not isinstance(item.get('uid'), str):
                    continue
                import json
                digest = hashlib.sha256(json.dumps(item, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
                self.receive('reconcile:' + digest, item['uid'])
            if len(result['data']) < 100:
                state.write({'next_offset': 0, 'completed_at': fields.Datetime.now()})
                return
            state.next_offset += 100



class CalBookingSync(models.Model):
    _inherit = 'emiliany.cal.booking'

    @api.model
    def _apply_booking(self, data, visited=()):
        uid = data.get('uid')
        status = data.get('status')
        if not isinstance(uid, str) or not uid or status not in ('accepted', 'pending', 'cancelled', 'rejected'):
            raise UserError('Invalid booking response')
        instance = _instance()
        lineage = set(visited) | {uid}
        if data.get('rescheduledFromUid'):
            lineage.add(data['rescheduledFromUid'])
        aliases = self.env['emiliany.cal.alias'].search([('instance', '=', instance), ('uid', 'in', list(lineage))])
        records = aliases.mapped('booking_id')
        if len(records) > 1:
            raise UserError('Conflicting booking lineage requires administrator review')
        record = records or self.create({'instance': instance, 'uid': uid})
        for alias in lineage - set(aliases.mapped('uid')):
            self.env['emiliany.cal.alias'].create({'instance': instance, 'uid': alias, 'booking_id': record.id})
        if status in ('cancelled', 'rejected'):
            if record.event_id:
                record.event_id.with_context(active_test=False, no_mail_to_attendees=True, dont_notify=True, mail_notrack=True).write({'active': False})
            record.write({'uid': uid, 'status': status, 'synced_at': fields.Datetime.now(), 'error': False})
            return
        attendees = data.get('attendees')
        if not isinstance(attendees, list) or not attendees:
            raise UserError('Booking has no attendees')
        partners = self.env['res.partner']
        for attendee in attendees:
            if not isinstance(attendee, dict) or not isinstance(attendee.get('email'), str):
                raise UserError('Invalid attendee')
            email = attendee['email'].strip().lower()
            if not email or '@' not in email or len(email) > 254:
                raise UserError('Invalid attendee email')
            matches = self.env['res.partner'].with_context(active_test=False).search([('email_normalized', '=', email)], limit=2)
            if len(matches) > 1:
                raise UserError('Ambiguous customer email')
            if matches and not matches.active:
                raise UserError('Customer contact is archived')
            partners |= matches or self.env['res.partner'].create({'name': attendee.get('name') or email, 'email': email})
        interval = booking_interval({'startTime': data.get('start'), 'endTime': data.get('end')})
        event_type = data.get('eventType') or {}
        event_type_id = event_type.get('id') if isinstance(event_type, dict) else None
        mapping = self.env['emiliany.cal.event.type'].search([('event_type_id', '=', event_type_id)], limit=1) if isinstance(event_type_id, int) else self.env['emiliany.cal.event.type']
        organizer_id = self.env['ir.config_parameter'].sudo().get_param('emiliany_cal_diy.organizer_id')
        organizer = mapping.organizer_id or (self.env['res.users'].browse(int(organizer_id)).exists() if organizer_id and organizer_id.isdigit() else self.env['res.users'])
        if not organizer:
            raise UserError('Configure the Cal.diy organizer')
        primary = partners[:1]
        leads = self.env['crm.lead'].search([('partner_id', '=', primary.id), ('active', '=', True)], limit=2)
        lead = leads if len(leads) == 1 else self.env['crm.lead']
        if not leads and mapping.create_opportunity:
            lead = self.env['crm.lead'].create({'name': data.get('title') or 'Consultation', 'partner_id': primary.id, 'type': 'opportunity'})
        description = data.get('description') if isinstance(data.get('description'), str) else ''
        event_values = {'name': data.get('title') or 'Consultation', 'start': interval[0], 'stop': interval[1],
                        'description': html.escape(description).replace('\n', '<br/>'),
                        'user_id': organizer.id, 'partner_ids': [(6, 0, partners.ids)], 'active': True,
                        'opportunity_id': lead.id or False, 'location': data.get('location') if isinstance(data.get('location'), str) else False}
        meeting_url = data.get('meetingUrl')
        if isinstance(meeting_url, str) and meeting_url.startswith(('https://', 'http://')):
            event_values['videocall_location'] = meeting_url
        event_model = self.env['calendar.event'].with_context(no_mail_to_attendees=True, dont_notify=True, mail_notrack=True, mail_create_nosubscribe=True)
        if record.event_id:
            event = record.event_id.with_context(active_test=False, no_mail_to_attendees=True, dont_notify=True, mail_notrack=True)
            event.write(event_values)
        else:
            event = event_model.create(event_values)
        record.write({'uid': uid, 'event_id': event.id, 'partner_id': primary.id, 'opportunity_id': lead.id or False,
                      'status': status, 'event_type': str(event_type.get('id', '')) if isinstance(event_type, dict) else '',
                      'synced_at': fields.Datetime.now(), 'external_updated_at': data.get('updatedAt') or False, 'error': False})


class CalSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    cal_diy_organizer_id = fields.Many2one(
        'res.users', string='Default Cal.diy organizer',
        config_parameter='emiliany_cal_diy.organizer_id',
        domain=[('share', '=', False), ('active', '=', True)],
    )
