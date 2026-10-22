{
    'name': 'Authentik JIT Provisioning',
    'summary': 'Provision internal Odoo users from validated Authentik claims',
    'version': '19.0.1.0.0',
    'category': 'Authentication',
    'license': 'AGPL-3',
    'depends': ['auth_oauth', 'auth_oidc'],
    'data': ['views/auth_oauth_provider_views.xml'],
    'installable': True,
    'application': False,
}
