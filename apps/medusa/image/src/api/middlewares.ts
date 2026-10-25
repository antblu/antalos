import { timingSafeEqual } from "node:crypto"
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import type { ICustomerModuleService, IAuthModuleService } from "@medusajs/framework/types"
import { Modules, MedusaError } from "@medusajs/framework/utils"
import { authenticate, defineMiddlewares } from "@medusajs/framework/http"
export default defineMiddlewares({ routes: [
  { matcher: "/store/*", middlewares: [authenticate("customer", ["bearer", "session"], { allowUnregistered: true, allowUnauthenticated: true }), async (req, _res, next) => {
    const context = (req as unknown as AuthenticatedMedusaRequest).auth_context
    if (context?.actor_id) {
      try {
        // Bearer JWTs survive identity deletion cryptographically. Check the active account on every Store request.
        await req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER).retrieveCustomer(context.actor_id)
        await req.scope.resolve<IAuthModuleService>(Modules.AUTH).retrieveAuthIdentity(context.auth_identity_id)
      } catch (error) {
        if (error instanceof MedusaError && error.type === MedusaError.Types.NOT_FOUND) { _res.status(401).json({ message: "Sign in again" }); return }
        throw error
      }
    }
    next()
  }] },
  { matcher: /^\/store\/account\/?$/, middlewares: [authenticate("customer", ["bearer"], { allowUnregistered: true })] },
  { matcher: "/store/account/settings", middlewares: [authenticate("customer", ["bearer"])] },
  { matcher: "/store/account/marketing", middlewares: [authenticate("customer", ["bearer"])] },
  { matcher: "/store/customers", method: "POST", middlewares: [(_req, res) => { res.status(403).json({ message: "Complete account creation through /store/account with legal acceptance" }) }] },
  { matcher: "/store/newsletter", middlewares: [(req, res, next) => {
    const expected = process.env.NEWSLETTER_SERVER_SECRET || ""
    const supplied = req.headers["x-newsletter-secret"]
    if (!expected || typeof supplied !== "string" || Buffer.byteLength(expected) !== Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
      res.status(403).json({ message: "Not allowed" }); return
    }
    next()
  }] },
] })
