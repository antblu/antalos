{
    'name': 'Medusa Commerce Bridge',
    'version': '19.0.1.1.0',
    'license': 'LGPL-3',
    'depends': ['sale_management', 'sale_stock', 'account'],
    'data': ['security/groups.xml', 'security/ir.model.access.csv', 'data/cron.xml', 'data/invoice-email.xml', 'views/picking.xml'],
    'installable': True,
}
