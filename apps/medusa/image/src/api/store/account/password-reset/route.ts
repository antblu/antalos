import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { requestPasswordReset, completePasswordReset } from "../../../../lib/account/security"
export async function POST(req: MedusaRequest<Record<string, unknown>>, res: MedusaResponse) {
  const data = req.body || {}
  const result = data.operation === "complete"
    ? await completePasswordReset(req.scope, data.token, data.password, data.confirm_password)
    : await requestPasswordReset(req.scope, data.email, data.locale)
  return res.json(result)
}
