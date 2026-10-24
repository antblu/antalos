import type { ILockingModule, MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { CUSTOMER_SYNC } from "../../modules/customer-sync"
import type CustomerSyncService from "../../modules/customer-sync/service"
import { normalizeEmail, policyVersions, legalCurrent } from "./policy"
export const service = (c: MedusaContainer) => c.resolve<CustomerSyncService>(CUSTOMER_SYNC)
export async function locked<T>(c: MedusaContainer, key: string, fn: () => Promise<T>) {
  return c.resolve<ILockingModule>(Modules.LOCKING).execute(`customer-sync:${key}`, fn, { timeout: 10, expire: 120 })
}
export async function identity(c: MedusaContainer, email: string, customerId?: string, odooId?: number) {
  const s = service(c)
  email = normalizeEmail(email)
  const byCustomer = customerId ? (await s.listIdentities({ customer_id: customerId }))[0] : undefined
  const byOdoo = odooId ? (await s.listIdentities({ odoo_id: odooId }))[0] : undefined
  const byEmail = (await s.listIdentities({ email }))[0]
  const existing = byCustomer || byOdoo || byEmail
  if ([byCustomer, byOdoo, byEmail].some(x => x && existing && x.id !== existing.id)) throw new Error("Identity conflict requires review")
  if (existing) {
    if ((customerId && existing.customer_id && customerId !== existing.customer_id) ||
        (odooId && existing.odoo_id && odooId !== existing.odoo_id)) throw new Error("Identity linkage conflict")
    return s.updateIdentities({ id: existing.id, email, ...(customerId ? { customer_id: customerId } : {}), ...(odooId ? { odoo_id: odooId } : {}) })
  }
  return s.createIdentities({ email, customer_id: customerId ?? null, odoo_id: odooId ?? null })
}
export async function record(c: MedusaContainer, id: string, kind: "legal" | "marketing" | "profile", payload: Record<string, unknown>) {
  // All writers hold the identity lock. A unique revision is a second guard
  // against lock loss and makes same-millisecond choices deterministic.
  const previous = (await service(c).listDecisions({ identity_id: id }, { take: 1, order: { revision: "DESC" } }))[0]
  return service(c).createDecisions({ identity_id: id, revision: (previous?.revision || 0) + 1, kind, payload, available_at: new Date() })
}
export async function status(c: MedusaContainer, customerId: string) {
  const link = (await service(c).listIdentities({ customer_id: customerId }))[0]
  const history = link ? await service(c).listDecisions({ identity_id: link.id, kind: "legal" }, { order: { created_at: "DESC" } }) : []
  const decisions = link ? await service(c).listDecisions({ identity_id: link.id, kind: ["marketing", "legal"] }, { order: { revision: "DESC" }, take: 10000 }) : []
  return { legal_required: !legalCurrent(history), versions: policyVersions(), marketing_consent: decisions.find(d => typeof d.payload.consent === "boolean")?.payload.consent === true }
}
