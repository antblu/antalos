import { createHash } from "node:crypto"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { IAuthModuleService, ICacheService, ICustomerModuleService } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { mailConfigured } from "../../../../lib/account/mail"
import { requestEmailChange, confirmEmailChange } from "../../../../lib/account/security"
import { identity, locked, record, service, status } from "../../../../lib/customer-sync/store"

const invalid = (message: string) => new MedusaError(MedusaError.Types.INVALID_DATA, message)
async function context(req: AuthenticatedMedusaRequest) {
  if (!req.auth_context.actor_id) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Sign in again")
  const customers = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const customer = await customers.retrieveCustomer(req.auth_context.actor_id, { relations: ["addresses"] })
  const auth = req.scope.resolve<IAuthModuleService>(Modules.AUTH)
  // Linking can associate separate auth identities with the same customer.
  const identities = await auth.listAuthIdentities({ app_metadata: { customer_id: customer.id } }, { relations: ["provider_identities"] })
  return { customers, customer, auth, identities }
}
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { customer, identities } = await context(req)
  const providers = identities.flatMap(i => i.provider_identities || []).filter(p => ["google", "emailpass"].includes(p.provider))
  return res.json({ email_available: mailConfigured(), providers: providers.map(p => ({ provider: p.provider, email: p.provider === "emailpass" ? p.entity_id : String(p.user_metadata?.email || customer.email) })), ...(await status(req.scope, customer.id)) })
}
export async function POST(req: AuthenticatedMedusaRequest<Record<string, unknown>>, res: MedusaResponse) {
  const { customers, customer, auth, identities } = await context(req)
  const data = req.body || {}
  return locked(req.scope, `settings:${customer.id}`, async () => {
    const cache = req.scope.resolve<ICacheService>(Modules.CACHE)
    const key = `account-sensitive:${customer.id}`
    const attempts = await cache.get<number>(key) || 0
    if (attempts >= 10) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Try again in fifteen minutes")
    await cache.set(key, attempts + 1, 900)
    const providers = identities.flatMap(i => i.provider_identities || [])
    if (data.operation === "email-request") {
      const provider = providers.find(p => p.provider === "emailpass")
      if (provider) {
        const proof = await auth.authenticate("emailpass", { body: { email: provider.entity_id, password: typeof data.current_password === "string" ? data.current_password : "" }, url: req.url, headers: {}, query: {}, protocol: "https" })
        if (!proof.success || proof.authIdentity?.app_metadata?.customer_id !== customer.id) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Check your password")
      } else {
        const token = req.headers.authorization?.replace(/^Bearer /i, "") || ""
        if (await cache.get<string>(`account-google-proof:${createHash("sha256").update(token).digest("hex")}`) !== customer.id) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Sign in with Google again before changing your email")
      }
      return res.json(await requestEmailChange(req.scope, customer.id, customer.email!, data.email, data.locale))
    }
    if (data.operation === "email-confirm") return res.json(await confirmEmailChange(req.scope, customer.id, data.code))
    if (data.operation === "set-password") {
      if (providers.some(p => p.provider === "emailpass")) throw invalid("A password is already configured")
      if (typeof data.new_password !== "string" || data.new_password.length < 12 || data.new_password.length > 128 || data.new_password !== data.confirm_password) throw invalid("Use 12–128 characters and confirm your password")
      const token = req.headers.authorization?.replace(/^Bearer /i, "") || ""
      const proofKey = `account-google-proof:${createHash("sha256").update(token).digest("hex")}`
      if (await cache.get<string>(proofKey) !== customer.id || !providers.some(p => p.provider === "google")) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Sign out and sign in with Google again before setting a password")
      const existing = await auth.listProviderIdentities({ provider: "emailpass", entity_id: customer.email! })
      if (existing.length) throw invalid("Password setup requires support to avoid an identity conflict")
      const created = await auth.register("emailpass", { body: { email: customer.email, password: data.new_password }, url: req.url, headers: {}, query: {}, protocol: "https" })
      if (!created.success || !created.authIdentity || Object.keys(created.authIdentity.app_metadata || {}).some(k => k.endsWith("_id"))) throw invalid("Password setup requires support")
      await auth.updateAuthIdentities({ id: created.authIdentity.id, app_metadata: { ...created.authIdentity.app_metadata, customer_id: customer.id } })
      await cache.invalidate(proofKey)
      return res.json({ saved: true })
    }
    if (data.operation === "password") {
      const provider = providers.find(p => p.provider === "emailpass")
      if (!provider || typeof data.current_password !== "string") throw invalid("Password sign-in is required")
      if (typeof data.new_password !== "string" || data.new_password.length < 12 || data.new_password.length > 128 || data.new_password !== data.confirm_password || data.new_password === data.current_password) throw invalid("Use a different password of 12–128 characters and confirm it")
      const proof = await auth.authenticate("emailpass", { body: { email: provider.entity_id, password: typeof data.current_password === "string" ? data.current_password : "" }, url: req.url, headers: {}, query: {}, protocol: "https" })
      if (!proof.success || proof.authIdentity?.app_metadata?.customer_id !== customer.id) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Check your current password")
      const result = await auth.updateProvider("emailpass", { entity_id: provider.entity_id, password: data.new_password })
      if (!result.success) throw invalid("Password could not be changed")
      return res.json({ saved: true })
    }
    if (data.operation === "export") {
      const link = (await service(req.scope).listIdentities({ customer_id: customer.id }))[0]
      const decisions = link ? await service(req.scope).listDecisions({ identity_id: link.id, kind: ["legal", "marketing"] }, { order: { revision: "DESC" }, take: 10000 }) : []
      const query = req.scope.resolve("query")
      const fetchOrders = (skip: number) => query.graph({ entity: "order", fields: ["display_id", "created_at", "status", "currency_code", "total", "items.title", "items.quantity", "items.unit_price"], filters: { customer_id: customer.id }, pagination: { skip, take: 100, order: { id: "ASC" } } })
      const orders: Awaited<ReturnType<typeof fetchOrders>>["data"] = []
      for (let offset = 0; ; offset += 100) {
        const page = await fetchOrders(offset)
        orders.push(...page.data)
        if (page.data.length < 100) break
      }
      // Explicit allowlist: no customer metadata, internal links, auth identities or admin notes.
      return res.json({ exported_at: new Date().toISOString(), profile: { email: customer.email, first_name: customer.first_name, last_name: customer.last_name, phone: customer.phone }, addresses: customer.addresses?.map(a => ({ first_name: a.first_name, last_name: a.last_name, company: a.company, address_1: a.address_1, address_2: a.address_2, city: a.city, province: a.province, postal_code: a.postal_code, country_code: a.country_code, phone: a.phone, default_shipping: a.is_default_shipping, default_billing: a.is_default_billing })), orders: orders.map(o => ({ number: o.display_id, created_at: o.created_at, status: o.status, currency: o.currency_code, total: Number(o.total || 0), items: o.items?.map(item => ({ title: item?.title, quantity: item?.quantity, unit_price: item?.unit_price })) })), preferences: publicPreferences(customer.metadata?.shopping_preferences), consent: decisions.map(d => ({ type: d.kind, consent: d.payload.consent, at: d.payload.at, source: d.payload.source, terms_version: d.payload.terms_version, privacy_version: d.payload.privacy_policy_version })), scope: "Storefront profile, saved addresses, order summaries, preferences and consent. Contact support for a complete personal-data request covering retained Mautic and Odoo records and further order details." })
    }
    if (data.operation === "disconnect-google") {
      if (!providers.some(p => p.provider === "emailpass")) throw invalid("Set up another sign-in method before disconnecting Google")
      const provider = providers.find(p => p.provider === "emailpass")!
      const proof = await auth.authenticate("emailpass", { body: { email: provider.entity_id, password: typeof data.current_password === "string" ? data.current_password : "" }, url: req.url, headers: {}, query: {}, protocol: "https" })
      if (!proof.success || proof.authIdentity?.app_metadata?.customer_id !== customer.id) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Check your password")
      await auth.deleteProviderIdentities(providers.filter(p => p.provider === "google").map(p => p.id))
      const empty = identities.filter(i => i.provider_identities?.length && i.provider_identities.every(p => p.provider === "google"))
      if (empty.length) await auth.deleteAuthIdentities(empty.map(i => i.id))
      return res.json({ saved: true })
    }
    if (data.operation === "close") {
      if (data.confirm_email !== customer.email) throw invalid("Enter your account email to confirm")
      const provider = providers.find(p => p.provider === "emailpass")
      if (provider) {
        const proof = await auth.authenticate("emailpass", { body: { email: provider.entity_id, password: typeof data.current_password === "string" ? data.current_password : "" }, url: req.url, headers: {}, query: {}, protocol: "https" })
        if (!proof.success || proof.authIdentity?.app_metadata?.customer_id !== customer.id) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Check your password")
      } else {
        const token = req.headers.authorization?.replace(/^Bearer /i, "") || ""
        const proofKey = `account-google-proof:${createHash("sha256").update(token).digest("hex")}`
        if (!providers.some(p => p.provider === "google") || await cache.get<string>(proofKey) !== customer.id) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Sign out and sign in with Google again, then confirm closure within five minutes")
        await cache.invalidate(proofKey)
      }
      // Commit withdrawal before disabling access. External delivery uses the durable outbox.
      await locked(req.scope, "identities", async () => {
        const link = await identity(req.scope, customer.email!, customer.id)
        await record(req.scope, link.id, "marketing", { consent: false, at: new Date().toISOString(), source: "account_closure" })
      })
      // Soft deletion preserves order/accounting references; never delete Odoo records.
      await customers.softDeleteCustomers([customer.id])
      await auth.deleteAuthIdentities(identities.map(i => i.id))
      return res.json({ closed: true })
    }
    throw invalid("Unknown account operation")
  })
}

function publicPreferences(value: unknown) {
  if (!value || typeof value !== "object") return {}
  const data = value as Record<string, unknown>
  return Object.fromEntries(["locale", "countryCode", "currencyCode"].filter(k => typeof data[k] === "string").map(k => [k, data[k]]))
}
