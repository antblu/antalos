import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ICustomerModuleService } from "@medusajs/framework/types"
import { Modules, MedusaError } from "@medusajs/framework/utils"
import { normalizeEmail } from "../../../lib/customer-sync/policy"
import { identity, locked, record, service } from "../../../lib/customer-sync/store"
// Website-only endpoint authenticated by a server credential, never a browser key.
export async function POST(req: MedusaRequest<Record<string, unknown>>, res: MedusaResponse) {
  let email: string
  try { email = normalizeEmail(req.body?.email) } catch { throw new MedusaError(MedusaError.Types.INVALID_DATA, "Valid email required") }
  if (req.body.consent !== true) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Marketing consent required")
  await locked(req.scope, "identities", async () => {
    const customers = await req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER).listCustomers({ email })
    if (customers.length > 1) throw new Error("Ambiguous newsletter identity")
    const link = await identity(req.scope, email, customers[0]?.id)
    const last = (await service(req.scope).listDecisions({ identity_id: link.id, kind: ["marketing", "legal"] }, { take: 1, order: { revision: "DESC" } }))[0]
    // Short dedupe window absorbs double-clicks/retries without silently ignoring a later re-subscription.
    if (last?.payload.consent === true && Date.now() - new Date(last.created_at).getTime() < 60000) return
    await record(req.scope, link.id, "marketing", { consent: true, at: new Date().toISOString(), source: "website_newsletter", locale: req.body.locale === "es" ? "es" : "en" })
  })
  return res.status(202).json({ accepted: true })
}
