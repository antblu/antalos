import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto"
import type { MedusaContainer, IAuthModuleService, ICacheService, ICustomerModuleService, IEventBusModuleService, Logger } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { locked, service, identity } from "../customer-sync/store"
import { normalizeEmail } from "../customer-sync/policy"
import { changeCustomerEmail } from "../../workflows/change-customer-email"
import { mailConfigured, sendAccountMail, storefrontLink } from "./mail"
const digest = (value: string) => createHash("sha256").update(value).digest("hex")
const cache = (c: MedusaContainer) => c.resolve<ICacheService>(Modules.CACHE)
const invalid = (message: string) => new MedusaError(MedusaError.Types.INVALID_DATA, message)
function emailAddress(value: unknown) { try { return normalizeEmail(value) } catch { throw invalid("Enter a valid email address") } }
export async function mailBudget(c: MedusaContainer, email: string) {
  if (!mailConfigured()) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Account email delivery is not configured")
  return locked(c, "account-mail-budget", async () => {
    for (const [key, limit] of [[`account-mail:${digest(email)}`, 5], ["account-mail:global", 100]] as const) {
      const n = await cache(c).get<number>(key) || 0
      if (n >= limit) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Too many email requests; try again later")
      await cache(c).set(key, n + 1, 3600)
    }
  })
}
export async function requestEmailChange(c: MedusaContainer, customerId: string, oldEmail: string, email: unknown, locale: unknown) {
  const newEmail = emailAddress(email)
  if (newEmail === oldEmail) throw invalid("Choose a different email")
  await mailBudget(c, newEmail)
  const code = String(randomInt(10000000, 100000000))
  const key = `account-email:${customerId}`
  await cache(c).set(key, { oldEmail, newEmail, hash: digest(code), attempts: 0, expires: Date.now() + 600000 }, 600)
  try {
    await sendAccountMail(newEmail, typeof locale === "string" && locale.startsWith("es") ? "EMILIANY — Verifica tu correo" : "EMILIANY — Verify your email", typeof locale === "string" && locale.startsWith("es") ? `Tu código de verificación es ${code}. Caduca en 10 minutos. Si no solicitaste este cambio, ignora este mensaje.` : `Your verification code is ${code}. It expires in 10 minutes. If you did not request this change, ignore this message.`)
  } catch { await cache(c).invalidate(key); throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Verification email could not be delivered") }
  return { verification_required: true }
}
export async function confirmEmailChange(c: MedusaContainer, customerId: string, code: unknown) {
  const key = `account-email:${customerId}`
  const pending = await cache(c).get<{ oldEmail: string; newEmail: string; hash: string; attempts: number; expires: number }>(key)
  if (!pending || pending.expires < Date.now() || pending.attempts >= 5) throw invalid("Request a new verification code")
  await cache(c).set(key, { ...pending, attempts: pending.attempts + 1 }, Math.max(1, Math.ceil((pending.expires - Date.now()) / 1000)))
  if (typeof code !== "string" || !/^\d{8}$/.test(code) || !timingSafeEqual(Buffer.from(digest(code)), Buffer.from(pending.hash))) throw invalid("Check your verification code")
  const outcome = await locked(c, "identities", async () => {
    const customers = c.resolve<ICustomerModuleService>(Modules.CUSTOMER), auth = c.resolve<IAuthModuleService>(Modules.AUTH)
    const customer = await customers.retrieveCustomer(customerId)
    if (customer.email !== pending.oldEmail) throw invalid("Your email changed; request a new code")
    const matches = await customers.listCustomers({ email: pending.newEmail })
    const links = await service(c).listIdentities({ email: pending.newEmail })
    const providers = await auth.listProviderIdentities({ provider: "emailpass", entity_id: pending.newEmail })
    if (matches.length || providers.length || links.some(l => l.customer_id !== customerId)) throw invalid("This email cannot be used; contact support")
    const identities = await auth.listAuthIdentities({ app_metadata: { customer_id: customerId } }, { relations: ["provider_identities"] })
    await identity(c, pending.oldEmail, customerId)
    await changeCustomerEmail(c).run({ input: { customerId, oldEmail: pending.oldEmail, newEmail: pending.newEmail, providers: identities.flatMap(i => i.provider_identities || []).filter(p => p.provider === "emailpass").map(p => ({ id: p.id, entity_id: p.entity_id })) } })
    await cache(c).invalidate(key)
    return { saved: true }
  })
  // Courtesy delivery never holds the shared identity lock or rolls back a verified change.
  await sendAccountMail(pending.oldEmail, "EMILIANY — Account email changed", "Your account email was changed after verification. If this was not you, contact EMILIANY immediately.").catch(() => c.resolve<Logger>("logger").warn("account.email_change_alert_failed"))
  return outcome
}
export async function requestPasswordReset(c: MedusaContainer, email: unknown, locale: unknown) {
  const normalized = emailAddress(email)
  await mailBudget(c, normalized)
  // Identical enqueue path for every address avoids an account-existence timing oracle.
  await c.resolve<IEventBusModuleService>(Modules.EVENT_BUS).emit({ name: "account.password_reset_requested", data: { email: normalized, locale: typeof locale === "string" && locale.startsWith("es") ? "es" : "en" } })
  return { accepted: true }
}
export async function deliverPasswordReset(c: MedusaContainer, email: string, locale: string) {
  const normalized = emailAddress(email)
  const auth = c.resolve<IAuthModuleService>(Modules.AUTH)
  const customers = await c.resolve<ICustomerModuleService>(Modules.CUSTOMER).listCustomers({ email: normalized, has_account: true })
  if (customers.length !== 1) return { accepted: true }
  const providers = await auth.listProviderIdentities({ provider: "emailpass", entity_id: normalized }, { relations: ["auth_identity"] })
  if (providers.length !== 1 || providers[0].auth_identity?.app_metadata?.customer_id !== customers[0].id) return { accepted: true }
  const token = randomBytes(32).toString("hex")
  // A new request supersedes the previous link without storing a plaintext token.
  const nonce = randomBytes(16).toString("hex")
  await cache(c).set(`account-reset-current:${customers[0].id}`, nonce, 900)
  await cache(c).set(`account-reset:${digest(token)}`, { customerId: customers[0].id, email: normalized, nonce }, 900)
  const link = storefrontLink("/account/reset-password", locale) + `#token=${token}`
  try { await sendAccountMail(normalized, typeof locale === "string" && locale.startsWith("es") ? "EMILIANY — Restablece tu contraseña" : "EMILIANY — Reset your password", typeof locale === "string" && locale.startsWith("es") ? `Restablece tu contraseña: ${link}\nEl enlace caduca en 15 minutos y se puede usar una sola vez. Si no lo solicitaste, ignora este mensaje.` : `Reset your password: ${link}\nThis link expires in 15 minutes and can be used once. If you did not request it, ignore this message.`) }
  catch { await cache(c).invalidate(`account-reset:${digest(token)}`); throw new Error("Password reset email could not be delivered") }
  return { accepted: true }
}
export async function completePasswordReset(c: MedusaContainer, token: unknown, password: unknown, confirmation: unknown) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token) || typeof password !== "string" || password.length < 12 || password.length > 128 || password !== confirmation) throw invalid("Check the link and matching passwords of 12–128 characters")
  return locked(c, `reset:${digest(token)}`, async () => {
    const key = `account-reset:${digest(token)}`
    const pending = await cache(c).get<{ customerId: string; email: string; nonce: string }>(key)
    if (!pending || await cache(c).get<string>(`account-reset-current:${pending.customerId}`) !== pending.nonce) throw invalid("Request a new reset link")
    return locked(c, `settings:${pending.customerId}`, async () => {
      const customer = await c.resolve<ICustomerModuleService>(Modules.CUSTOMER).retrieveCustomer(pending.customerId)
      if (customer.email !== pending.email) throw invalid("Request a new reset link")
      const auth = c.resolve<IAuthModuleService>(Modules.AUTH)
      const providers = await auth.listProviderIdentities({ provider: "emailpass", entity_id: pending.email }, { relations: ["auth_identity"] })
      if (providers.length !== 1 || providers[0].auth_identity?.app_metadata?.customer_id !== customer.id) throw invalid("Request a new reset link")
      await cache(c).invalidate(key)
      const result = await auth.updateProvider("emailpass", { entity_id: pending.email, password })
      if (!result.success) throw invalid("Request a new reset link")
      await cache(c).invalidate(`account-reset-current:${customer.id}`)
      return { saved: true }
    })
  })
}
