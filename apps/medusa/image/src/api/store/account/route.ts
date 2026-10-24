import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { IAuthModuleService, ICustomerModuleService, ICacheService } from "@medusajs/framework/types"
import { Modules, MedusaError } from "@medusajs/framework/utils"
import { identity, locked, record, status } from "../../../lib/customer-sync/store"
import { policyVersions, normalizeEmail } from "../../../lib/customer-sync/policy"
import { completeCustomerAccount } from "../../../workflows/complete-customer-account"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const auth = req.scope.resolve<IAuthModuleService>(Modules.AUTH)
  const identity = await auth.retrieveAuthIdentity(req.auth_context.auth_identity_id, { relations: ["provider_identities"] })
  const google = identity.provider_identities?.find(p => p.provider === "google")
  const email = google?.user_metadata?.email
  const customers = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const matches = !req.auth_context.actor_id && typeof email === "string" ? await customers.listCustomers({ email: normalizeEmail(email) }) : []
  return res.json({ ...(req.auth_context.actor_id ? await status(req.scope, req.auth_context.actor_id) : { legal_required: true, versions: policyVersions() }),
    email: typeof email === "string" ? email : undefined,
    linking_required: matches.some(c => c.has_account), pending: !req.auth_context.actor_id,
  })
}
export async function POST(req: AuthenticatedMedusaRequest<Record<string, unknown>>, res: MedusaResponse) {
  const data = req.body || {}, versions = policyVersions()
  const auth = req.scope.resolve<IAuthModuleService>(Modules.AUTH)
  const authId = req.auth_context.auth_identity_id
  const authIdentity = await auth.retrieveAuthIdentity(authId, { relations: ["provider_identities"] })
  const google = authIdentity.provider_identities?.find(p => p.provider === "google")
  const emailpass = authIdentity.provider_identities?.find(p => p.provider === "emailpass")
  const provider = google ? "google" : "credentials"
  const email = normalizeEmail(google?.user_metadata?.email || emailpass?.entity_id)
  const customers = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  return locked(req.scope, "identities", async () => {
    let customerId = req.auth_context.actor_id
    if (!customerId) {
      const matches = await customers.listCustomers({ email })
      if (matches.length > 1) throw new MedusaError(MedusaError.Types.CONFLICT, "Account linkage requires support")
      const existing = matches[0]
      if (existing) {
        // A verified Google email is insufficient to take over a password account.
        // Require a fresh login to that account before attaching this subject.
        if (!google || typeof data.password !== "string") throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Existing account password required")
        const cache = req.scope.resolve<ICacheService>(Modules.CACHE)
        const attemptKey = `customer-google-link:${existing.id}`
        const attempts = (await cache.get<number>(attemptKey)) || 0
        if (attempts >= 5) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Too many linking attempts; try again later")
        await cache.set(attemptKey, attempts + 1, 900)
        const proof = await auth.authenticate("emailpass", { body: { email, password: data.password }, url: req.url, headers: {}, query: {}, protocol: "https" })
        if (!proof.success || proof.authIdentity?.app_metadata?.customer_id !== existing.id) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Account linking failed")
        await cache.invalidate(attemptKey)
        const current = await status(req.scope, existing.id)
        if (current.legal_required) validateLegal(data, versions)
        if (current.legal_required) {
          const link = await identity(req.scope, email, existing.id)
          await record(req.scope, link.id, "legal", { ...legalPayload(data, versions, provider, "policy_reacceptance"), customer_id: existing.id })
        }
        await auth.updateAuthIdentities({ id: authId, app_metadata: { ...authIdentity.app_metadata, customer_id: existing.id } })
        return res.json({ customer_id: existing.id, linked: true })
      }
      validateLegal(data, versions)
      const payload = { ...legalPayload(data, versions, provider, google ? "google_oauth_registration" : "account_registration"),
        consent: data.marketing_consent === true, initial_consent: true }
      const { result } = await completeCustomerAccount(req.scope).run({ input: { authIdentityId: authId,
        customerData: { email, first_name: google ? String(google.user_metadata?.given_name || "") : clean(data.first_name), last_name: google ? String(google.user_metadata?.family_name || "") : clean(data.last_name) }, payload } })
      return res.json({ customer_id: result.id, linked: false })
    }
    validateLegal(data, versions)
    const customer = await customers.retrieveCustomer(customerId)
    const link = await identity(req.scope, customer.email!, customerId)
    await record(req.scope, link.id, "legal", { ...legalPayload(data, versions, provider, "policy_reacceptance"), customer_id: customerId })
    return res.json({ customer_id: customerId })
  })
}
function clean(value: unknown) { return typeof value === "string" ? value.trim().slice(0, 200) : "" }
function validateLegal(data: Record<string, unknown>, versions: { terms: string; privacy: string }) {
  if (data.terms_accepted !== true || data.terms_version !== versions.terms || data.privacy_policy_version !== versions.privacy) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Accept the current Terms and Privacy Policy")
}
function legalPayload(data: Record<string, unknown>, versions: { terms: string; privacy: string }, provider: string, source: string) {
  return { terms_accepted: true, at: new Date().toISOString(), terms_version: versions.terms, privacy_policy_version: versions.privacy, source, auth_provider: provider, locale: data.locale === "es" ? "es" : "en" }
}
