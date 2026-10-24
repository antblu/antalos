import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ICustomerModuleService } from "@medusajs/framework/types"
import { Modules, MedusaError } from "@medusajs/framework/utils"
import { identity, locked, record, status } from "../../../../lib/customer-sync/store"
export async function POST(req: AuthenticatedMedusaRequest<{ consent: boolean; locale?: string }>, res: MedusaResponse) {
  if (typeof req.body?.consent !== "boolean") throw new MedusaError(MedusaError.Types.INVALID_DATA, "Explicit preference required")
  const customer = await req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER).retrieveCustomer(req.auth_context.actor_id)
  await locked(req.scope, "identities", async () => {
    const link = await identity(req.scope, customer.email!, customer.id)
    await record(req.scope, link.id, "marketing", { consent: req.body.consent, at: new Date().toISOString(), source: "account_settings", locale: req.body.locale === "es" ? "es" : "en" })
  })
  res.json(await status(req.scope, customer.id))
}
