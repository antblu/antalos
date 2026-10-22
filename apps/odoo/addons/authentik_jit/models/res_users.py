import hashlib
import logging

from odoo import api, models
from odoo.exceptions import AccessDenied

_logger = logging.getLogger(__name__)


class ResUsers(models.Model):
    _inherit = 'res.users'

    @api.model
    def _auth_oauth_signin(self, provider, validation, params):
        provider_rec = self.env['auth.oauth.provider'].sudo().browse(provider).exists()
        if not provider_rec or not provider_rec.jit_enabled:
            return super()._auth_oauth_signin(provider, validation, params)

        def reject(reason):
            # Never log claims, email addresses, subjects, or access tokens.
            _logger.warning('JIT login rejected for provider %s: %s', provider, reason)
            raise AccessDenied()

        subject = validation.get('user_id')
        if not isinstance(subject, str) or not subject.strip():
            reject('missing subject')
        if not params.get('access_token'):
            reject('missing access token')

        def lock(identity):
            key = int.from_bytes(hashlib.sha256(identity.encode()).digest()[:8], 'big', signed=True)
            self.env.cr.execute('SELECT pg_advisory_xact_lock(%s)', [key])

        lock(f'authentik_jit:subject:{provider}:{subject}')
        users = self.sudo().with_context(active_test=False)
        user = users.search([
            ('oauth_provider_id', '=', provider), ('oauth_uid', '=', subject),
        ], limit=2)
        if user:
            if len(user) != 1 or not user.active or user == provider_rec.jit_user_template_id:
                reject('inactive, ambiguous, or template identity')
            user.write({'oauth_access_token': params['access_token']})
            return user.login

        # Respect callers that explicitly disallow account creation or linking.
        if self.env.context.get('no_user_creation'):
            return None
        email = validation.get('email')
        if validation.get('email_verified') is not True:
            reject('email is not verified')
        if not isinstance(email, str) or '@' not in email or len(email.strip()) > 254:
            reject('missing or invalid email')
        email = email.strip().lower()
        lock(f'authentik_jit:email:{email}')
        candidates = users.search([
            '|', ('login', '=ilike', email), ('email', '=ilike', email),
        ])
        # =ilike treats percent/underscore as wildcards; require exact equality.
        candidates = candidates.filtered(
            lambda u: (u.login or '').strip().lower() == email
            or (u.email or '').strip().lower() == email
        )
        if candidates:
            if len(candidates) != 1 or not provider_rec.jit_link_by_verified_email:
                reject('email linking is disabled or ambiguous')
            user = candidates
            if not user.active or user == provider_rec.jit_user_template_id:
                reject('inactive or template account')
            if user.oauth_uid or (user.oauth_provider_id and user.oauth_provider_id != provider_rec):
                reject('account already has an OAuth identity')
            user.write({
                'oauth_provider_id': provider,
                'oauth_uid': subject,
                'oauth_access_token': params['access_token'],
            })
            return user.login

        template = provider_rec.jit_user_template_id
        if not template or not template.active or template.share:
            reject('active internal user template is required')
        # Create a new identity, copying access settings only, never passwords,
        # API keys, OAuth credentials, partner data, or administrative preferences.
        user = users.with_context(no_reset_password=True, mail_create_nosubscribe=True).create({
            'name': validation.get('name') or email,
            'login': email,
            'email': email,
            'active': True,
            'group_ids': [(6, 0, template.group_ids.ids)],
            'company_id': template.company_id.id,
            'company_ids': [(6, 0, template.company_ids.ids)],
            'oauth_provider_id': provider,
            'oauth_uid': subject,
            'oauth_access_token': params['access_token'],
        })
        return user.login
