import { createHash } from "node:crypto"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { IAuthModuleService, ICacheService, ICustomerModuleService } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { generateJwtTokenWithChecks } from "@medusajs/medusa/api/auth/utils/generate-jwt-token"
function strings(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {}
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
}
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = req.scope.resolve<IAuthModuleService>(Modules.AUTH)
  const result = await auth.validateCallback("google", { url: req.url, headers: strings(req.headers), query: strings(req.query), body: strings(req.body), protocol: req.protocol })
  if (!result.success || !result.authIdentity) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Google sign-in failed")
  const customerId = result.authIdentity.app_metadata?.customer_id
  if (typeof customerId === "string") await req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER).retrieveCustomer(customerId)
  const response = await generateJwtTokenWithChecks(req.scope, { authIdentity: result.authIdentity, mfaChallenge: result.mfaChallenge, actorType: "customer", authProvider: "google" })
  if (typeof customerId === "string" && "token" in response && typeof response.token === "string") {
    // Only a completed OAuth exchange can issue this one-use recent-login proof.
    // JWT refresh must not turn an old session into recent authentication.
    await req.scope.resolve<ICacheService>(Modules.CACHE).set(`account-google-proof:${createHash("sha256").update(response.token).digest("hex")}`, customerId, 300)
  }
  return res.json(response)
}
export const POST = GET
