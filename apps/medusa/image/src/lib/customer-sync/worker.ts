import type { ICustomerModuleService, Logger, MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type OdooModuleService from "../../modules/odoo/service"
import { ODOO_MODULE } from "../../modules/odoo"
import { Mautic } from "./mautic"
import { partners, upsertPartner, upsertAddresses, type CustomerAddress } from "./odoo"
import { service, locked, identity, record } from "./store"
import { backoff, marketingState } from "./policy"
import { RemoteError } from "./transport"

type Customer = { id: string; email: string; first_name?: string | null; last_name?: string | null; phone?: string | null; addresses?: CustomerAddress[] }
export async function enqueueCustomer(c: MedusaContainer, id: string, event = "customer.updated") {
  const customer = await c.resolve<ICustomerModuleService>(Modules.CUSTOMER).retrieveCustomer(id)
  if (!customer.email) return
  await locked(c, "identities", async () => {
    const link = await identity(c, customer.email!, id)
    await record(c, link.id, "profile", { event })
  })
}
export async function reconcile(c: MedusaContainer) {
  const summary = { processed: 0, queued: 0, linked: 0, skipped: 0, failed: 0 }
  const customers = c.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const logger = c.resolve<Logger>("logger")
  for (let skip = 0; ; skip += 100) {
    const batch = await customers.listCustomers({}, { take: 100, skip, order: { id: "ASC" } })
    for (const customer of batch) {
      summary.processed++
      if (!customer.email) { summary.skipped++; continue }
      try { await enqueueCustomer(c, customer.id, "reconciliation"); summary.queued++ }
      catch { summary.failed++; logger.warn(JSON.stringify({ event: "customer_sync.reconcile_failed", customer_id: customer.id })) }
    }
    if (batch.length < 100) break
  }
  const odoo = c.resolve<OdooModuleService>(ODOO_MODULE)
  if (odoo.contactsEnabled) {
    let after = 0
    while (true) {
      const batch = await partners(odoo, after)
      for (const partner of batch) {
        summary.processed++
        try {
          await locked(c, "identities", async () => {
            const matches = await customers.listCustomers({ email: partner.email.trim().toLowerCase() })
            if (matches.length > 1) throw new Error("Ambiguous customer")
            const customerId = partner.x_medusa_customer_id || matches[0]?.id
            if (customerId && matches[0] && customerId !== matches[0].id) throw new Error("Link conflict")
            const link = await identity(c, partner.email, customerId || undefined, partner.id)
            await record(c, link.id, "profile", { event: "odoo.updated", partner: JSON.parse(JSON.stringify(partner)) })
            summary.queued++
            if (customerId) summary.linked++
          })
        } catch { summary.failed++; logger.warn(JSON.stringify({ event: "customer_sync.odoo_reconcile_failed", partner_id: partner.id })) }
        after = partner.id
      }
      if (batch.length < 100) break
    }
  }
  logger.info(JSON.stringify({ event: "customer_sync.reconciled", ...summary }))
  return summary
}
export async function drain(c: MedusaContainer) {
  if (process.env.CUSTOMER_SYNC_ENABLED !== "true") return { delivered: 0, failed: 0 }
  return locked(c, "delivery", async () => {
    const s = service(c), mautic = new Mautic(), odoo = c.resolve<OdooModuleService>(ODOO_MODULE)
    const logger = c.resolve<Logger>("logger")
    const tasks = await s.listDecisions({ delivered: false, available_at: { $lte: new Date() } }, { take: 100, order: { created_at: "ASC", revision: "ASC" } })
    const summary = { delivered: 0, failed: 0, created: 0, updated: 0 }
    for (const task of tasks) {
      if (task.kind === "legal" && !task.payload.initial_consent) { await s.updateDecisions({ id: task.id, delivered: true }); continue }
      try {
        {
          let link = await s.retrieveIdentity(task.identity_id)
          const latest = (await s.listDecisions({ identity_id: link.id, kind: ["marketing", "legal"] }, { take: 10000, order: { revision: "DESC" } })).find(d => typeof d.payload.consent === "boolean")
          // An older retry must never replay a superseded opt-in.
          let decision = latest?.payload
          let explicit = !!latest && !latest.delivered && decision?.source !== "mautic_unsubscribe"
          let customer: Customer | undefined
          if (link.customer_id && decision?.source !== "account_closure") {
            customer = await c.resolve<ICustomerModuleService>(Modules.CUSTOMER).retrieveCustomer(link.customer_id, { relations: ["addresses"] }) as Customer
          }
          let fields: Record<string, unknown> = { email: link.email }
          if (customer) {
            fields = { ...fields, firstname: customer.first_name || "", lastname: customer.last_name || "", phone: customer.phone || "", medusa_customer_id: customer.id, customer_type: "customer", customer_source: "medusa", tags: ["source:medusa", "customer"] }
            const address = customer.addresses?.find(a => a.is_default_billing) || customer.addresses?.[0]
            const partnerData: Record<string, unknown> = { name: [customer.first_name, customer.last_name].filter(Boolean).join(" ") || link.email, email: link.email, phone: customer.phone || false, x_medusa_customer_id: customer.id, ...(address ? { street: address.address_1 || false, street2: address.address_2 || false, city: address.city || false, zip: address.postal_code || false } : {}) }
            if (address?.country_code) {
              fields.country = address.country_code.toUpperCase()
              const countries = await odoo.execute<{ id: number }[]>("res.country", "search_read", [[["code", "=", address.country_code.toUpperCase()]]], { fields: ["id"], limit: 1 })
              if (countries[0]) partnerData.country_id = countries[0].id
            }
            // Odoo and Mautic deliveries retry together; deterministic upserts make replay safe.
            const partnerId = await upsertPartner(odoo, partnerData, link.odoo_id)
            link = await s.updateIdentities({ id: link.id, odoo_id: partnerId })
            await upsertAddresses(odoo, partnerId, customer.addresses || [])
          } else if (decision?.source !== "account_closure" && task.payload.partner && typeof task.payload.partner === "object") {
            const p = task.payload.partner as Record<string, unknown>
            fields = { ...fields, firstname: p.name, phone: p.phone || "", preferred_language: p.lang || "", customer_source: "odoo", customer_type: "contact", tags: ["source:odoo"], ...(Array.isArray(p.country_id) ? { country: p.country_id[1] } : {}) }
          }
          if (!customer && !task.payload.partner && decision?.source === "website_newsletter") {
            fields.customer_source = "newsletter"
            fields.customer_type = "subscriber"
            fields.tags = ["source:newsletter"]
          }
          if (link.odoo_id) fields.odoo_partner_id = link.odoo_id
          let contact = await mautic.resolve(link.email, link.customer_id, link.odoo_id, link.mautic_id)
          const dnc = contact?.doNotContact?.filter(d => d.channel === "email") || []
          if (dnc.some(d => d.dateAdded && new Date(d.dateAdded).getTime() > new Date(String(decision?.at || 0)).getTime())) explicit = false
          const state = marketingState(decision, dnc, explicit)
          // A Mautic unsubscribe becomes an application decision. Profile sync never clears it.
          if (dnc.length && decision?.consent === true && !state.removeUnsubscribe) {
            if (decision.source !== "mautic_unsubscribe") {
              const withdrawal = await locked(c, "identities", async () => {
              const current = (await s.listDecisions({ identity_id: link.id, kind: ["marketing", "legal"] }, { take: 10000, order: { revision: "DESC" } })).find(d => typeof d.payload.consent === "boolean")
              if (current?.id === latest?.id) return record(c, link.id, "marketing", { consent: false, at: new Date().toISOString(), source: "mautic_unsubscribe" })
              })
              if (withdrawal) decision = withdrawal.payload
            }
          }
          fields.marketing_consent = state.subscribed ? 1 : 0
          fields.newsletter_subscriber = state.subscribed ? 1 : 0
          if (decision) {
            fields.marketing_consent_date = String(decision.at).replace("T", " ").replace(/\.\d{3}Z$/, "")
            fields.marketing_consent_source = decision.source
            if (decision.locale) fields.preferred_language = decision.locale
          }
          if (customer) {
            const query = c.resolve("query")
            const { data: orders } = await query.graph({ entity: "order", fields: ["id", "created_at", "status", "total", "currency_code", "items.product_title", "items.product_id"], filters: { customer_id: customer.id } })
            const completed = orders.filter(o => o.status !== "canceled")
            const totals: Record<string, number> = {}
            for (const order of completed) totals[order.currency_code] = (totals[order.currency_code] || 0) + Number(order.total || 0)
            const last = [...completed].sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)))[0]
            fields.order_count = completed.length
            // Never combine COP/USD values into a misleading single total.
            fields.lifetime_value = JSON.stringify(totals)
            if (last) { fields.last_order_date = new Date(last.created_at).toISOString().slice(0,19).replace("T", " "); fields.last_product = last.items?.[0]?.product_title || "" }
            fields.last_commerce_event = task.payload.event || "customer.updated"
          }
          const action = contact ? "updated" : "created"
          contact = await mautic.save(contact, fields)
          logger.info(JSON.stringify({ event: "customer_sync.contact_upserted", action, identity_id: link.id, contact_id: contact.id }))
          if (!contact?.id) throw new Error("Mautic returned no contact ID")
          await s.updateIdentities({ id: link.id, mautic_id: contact.id })
          if (state.removeUnsubscribe) await mautic.request(`contacts/${contact.id}/dnc/email/remove`, "POST", {})
          if (!state.subscribed && !dnc.length) await mautic.request(`contacts/${contact.id}/dnc/email/add`, "POST", { reason: 1, comments: "No explicit marketing consent" })
          await mautic.membership("emiliany-newsletter", contact.id, state.subscribed)
          if (link.customer_id) await mautic.membership("emiliany-medusa-customers", contact.id, decision?.source !== "account_closure")
          if (link.odoo_id) {
            await mautic.membership("emiliany-odoo-customers", contact.id, true)
            await odoo.execute("res.partner", "write", [[link.odoo_id], { x_marketing_consent: state.subscribed }])
          }
          await s.updateDecisions({ id: task.id, delivered: true, failure: null })
          logger.info(JSON.stringify({ event: "customer_sync.delivered", decision_id: task.id, identity_id: link.id, contact_id: contact.id }))
          summary.delivered++
          summary[action]++
        }
      } catch (error) {
        const attempts = task.attempts + 1
        const delay = Math.max(backoff(attempts), error instanceof RemoteError ? error.retryAfter : 0)
        const failure = error instanceof RemoteError ? `${error.system}:${error.status}` : "configuration_or_identity_error"
        await s.updateDecisions({ id: task.id, attempts, failure, available_at: new Date(Date.now() + delay) })
        logger.warn(JSON.stringify({ event: "customer_sync.retry", decision_id: task.id, attempts, failure }))
        summary.failed++
      }
    }
    return summary
  })
}
