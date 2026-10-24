# Run through odoo shell. Reproduce the OAuth controller's anonymous commit
# environment without accepting tokens or committing test identities.
import uuid
from odoo import api, SUPERUSER_ID

with env.registry.cursor() as cr:
    anonymous = api.Environment(cr, None, {})
    cr.transaction.default_env = anonymous
    users = anonymous['res.users'].with_user(SUPERUSER_ID)
    provider = users.env['auth.oauth.provider'].search([('name', '=', 'antID')])
    nonce = uuid.uuid4().hex
    try:
        login = users._auth_oauth_signin(provider.id, {
            'groups': ['odoo-users'],
            'user_id': 'flush-check-' + nonce,
            'email': 'flush-check-' + nonce + '@example.invalid',
            'email_verified': True,
        }, {'access_token': 'temporary-transaction-token'})
        # Flush through the anonymous environment exactly as the controller's
        # commit does, but roll back instead of persisting the synthetic user.
        cr.flush()
        assert users.search([('login', '=', login)]).has_group('base.group_user')
        print('Anonymous OAuth commit flush regression passed')
    finally:
        cr.rollback()
