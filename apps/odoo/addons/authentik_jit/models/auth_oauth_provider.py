from odoo import fields, models


class AuthOauthProvider(models.Model):
    _inherit = 'auth.oauth.provider'

    jit_enabled = fields.Boolean(string='Enable JIT Provisioning', default=False)
    jit_user_template_id = fields.Many2one(
        'res.users',
        string='JIT User Template',
        domain=[('share', '=', False)],
        help='New users receive the groups and company access of this template user.',
    )
    jit_link_by_verified_email = fields.Boolean(
        string='Link Existing User by Verified Email', default=True,
    )
