from odoo import Command, fields, models, tools
from odoo.exceptions import AccessError, ValidationError


class SaleOrderInvoice(models.Model):
    _inherit = 'sale.order'

    medusa_invoice_id = fields.Many2one('account.move', copy=False, readonly=True, check_company=True)
    medusa_payment_id = fields.Many2one('account.payment', copy=False, readonly=True, check_company=True)
    medusa_invoice_mail_id = fields.Many2one('mail.mail', copy=False, readonly=True, ondelete='restrict')

    def _medusa_issue_invoice(self, order):
        """Called under medusa_sync's order lock; accounting and mail queue commit together."""
        self.ensure_one()
        if not self.env.user.has_group('medusa_bridge.group_medusa_bridge') or not self.medusa_order_id:
            raise AccessError('Medusa integration access required')
        params = self.env['ir.config_parameter'].sudo()
        company = self.company_id
        setting = lambda name: params.get_param('medusa_bridge.' + name + '.' + str(company.id))
        if setting('invoice_enabled') != 'true':
            return
        if self.medusa_invoice_id:
            # Even a distinct purchase event cannot create a second invoice or email.
            if not self.medusa_invoice_mail_id:
                raise ValidationError('Existing bridge invoice requires mail reconciliation')
            return
        if order.get('payment_status') != 'captured':
            raise ValidationError('Automatic invoicing requires an unrefunded captured purchase')
        if self.state != 'sale' or self.invoice_ids:
            raise ValidationError('Existing invoicing or sales state requires review')
        recipient = tools.email_normalize(order.get('email') or '', strict=True)
        sender = tools.email_normalize(setting('invoice_email_from') or '', strict=True)
        if not recipient or not sender:
            raise ValidationError('A valid invoice recipient and configured sender are required')

        # Sudo is limited to this already-validated bridge sale. The integration
        # account gains neither general accounting access nor a payment gateway.
        sale = self.sudo().with_company(company)
        try:
            journal_id = int(setting('invoice_journal_id') or 0)
            payment_journal_id = int(setting('payment_journal_id') or 0)
        except ValueError as error:
            raise ValidationError('Invalid invoice/payment journal mapping') from error
        journal = self.env['account.journal'].sudo().browse(journal_id).exists()
        payment_journal = self.env['account.journal'].sudo().browse(payment_journal_id).exists()
        if not journal or journal.company_id != company or journal.type != 'sale':
            raise ValidationError('Configure a sales journal for the bridge company')
        if not payment_journal or payment_journal.company_id != company or payment_journal.type not in ('bank', 'cash'):
            raise ValidationError('Configure a payment clearing journal for the bridge company')
        methods = payment_journal.inbound_payment_method_line_ids.filtered(lambda line: line.code == 'manual')
        if len(methods) != 1:
            raise ValidationError('Configure exactly one manual inbound payment method')
        if journal.currency_id and journal.currency_id != sale.currency_id or payment_journal.currency_id and payment_journal.currency_id != sale.currency_id:
            raise ValidationError('Journal currency mapping differs from the order')

        invoices = sale.with_context(default_journal_id=journal.id)._create_invoices()
        if len(invoices) != 1 or invoices.move_type != 'out_invoice' or invoices.company_id != company or invoices.currency_id != sale.currency_id:
            raise ValidationError('Expected one complete customer invoice')
        invoice = invoices
        if sale.currency_id.compare_amounts(invoice.amount_total, sale.amount_total) or sale.currency_id.compare_amounts(invoice.amount_tax, sale.amount_tax):
            raise ValidationError('Partial/delivery-based invoice or mismatched invoice totals requires review')
        invoice.action_post()
        wizard = self.env['account.payment.register'].sudo().with_company(company).with_context(
            active_model='account.move', active_ids=invoice.ids,
        ).create({'journal_id': payment_journal.id, 'payment_method_line_id': methods.id,
                  'amount': invoice.amount_total, 'communication': 'Medusa ' + self.medusa_order_id})
        payments = wizard._create_payments()
        if len(payments) != 1 or not invoice.currency_id.is_zero(invoice.amount_residual):
            raise ValidationError('Captured payment did not reconcile the complete invoice')
        # This records an existing external capture. The manual method never
        # charges Stripe/PayPal or claims bank settlement.
        pdf, _ = self.env['ir.actions.report'].sudo().with_company(company)._render_qweb_pdf(
            'account.account_invoices', res_ids=invoice.ids,
        )
        if not pdf.startswith(b'%PDF-'):
            raise ValidationError('Invoice report did not produce a PDF')
        attachment = self.env['ir.attachment'].sudo().create({
            'name': invoice.name.replace('/', '-') + '.pdf', 'raw': pdf,
            'mimetype': 'application/pdf', 'res_model': 'account.move', 'res_id': invoice.id,
        })
        template = self.env.ref('medusa_bridge.invoice_email').sudo()
        mail_id = template.send_mail(invoice.id, force_send=False, raise_exception=True, email_values={
            'email_from': sender, 'email_to': recipient, 'reply_to': company.email or sender,
            'recipient_ids': [Command.clear()], 'attachment_ids': [Command.link(attachment.id)],
            'auto_delete': False,
        })
        if not mail_id:
            raise ValidationError('Invoice email was not queued')
        sale.write({'medusa_invoice_id': invoice.id, 'medusa_payment_id': payments.id, 'medusa_invoice_mail_id': mail_id})
