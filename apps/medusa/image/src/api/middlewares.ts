import { timingSafeEqual } from "node:crypto"
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import type { ICustomerModuleService, IAuthModuleService } from "@medusajs/framework/types"
import { Modules, MedusaError } from "@medusajs/framework/utils"
import { authenticate, defineMiddlewares } from "@medusajs/framework/http"
import { emailSignInToken, hasEmailSignInProof } from "../lib/account/sign-in"

const readCustomerBearer = authenticate("customer", ["bearer"], {
  allowUnregistered: true, allowUnauthenticated: true, requireMfa: false,
})

export default defineMiddlewares({ routes: [
  { matcher: "/auth/:actor_type/:auth_provider", methods: ["GET", "POST"], middlewares: [(req, res, next) => {
    // The exact custom route handles password sign-in. Reject aliases that reach
    // Medusa's generic route after Express decodes its path parameters.
    if (req.params.actor_type === "customer" && req.params.auth_provider === "emailpass") {
      return res.status(404).json({ message: "Use /auth/customer/emailpass to sign in" })
    }
    next()
  }] },
  { matcher: "/auth/session", method: "POST", middlewares: [readCustomerBearer, (request, res, next) => {
    const { auth_context: context } = request as unknown as AuthenticatedMedusaRequest
    if (context?.actor_type === "customer" && context.auth_provider !== "google" &&
        (!context.actor_id || !hasEmailSignInProof(context.app_metadata))) {
      return res.status(401).json({ message: "Sign in again with an email code" })
    }
    next()
  }] },
  { matcher: "/hooks/commerce/fulfillment", bodyParser: { sizeLimit: "64kb", preserveRawBody: true }, middlewares: [] },
  { matcher: "/auth/token/refresh", method: "POST", middlewares: [
    authenticate("customer", ["session", "bearer"], { allowUnregistered: true, allowUnauthenticated: true, requireMfa: false }),
    async (request, res, next) => {
      const { auth_context: context, scope } = request as unknown as AuthenticatedMedusaRequest
      if (context?.actor_type !== "customer" || context.auth_provider === "google") return next()
      if (!context.actor_id || context.auth_provider !== "emailpass" ||
          !hasEmailSignInProof(context.app_metadata) || !context.mfa_challenge_completed_at) {
        return res.status(401).json({ message: "Sign in again with an email code" })
      }
      const identity = await scope.resolve<IAuthModuleService>(Modules.AUTH).retrieveAuthIdentity(context.auth_identity_id, { relations: ["provider_identities"] })
      if (identity.app_metadata?.customer_id !== context.actor_id ||
          !identity.provider_identities?.some(provider => provider.provider === "emailpass")) {
        return res.status(401).json({ message: "Sign in again" })
      }
      await scope.resolve<ICustomerModuleService>(Modules.CUSTOMER).retrieveCustomer(context.actor_id)
      return res.setHeader("Cache-Control", "no-store").json({ token: await emailSignInToken(scope, identity, context.mfa_challenge_completed_at) })
    },
  ] },
  { matcher: /^\/store\/.*/i, middlewares: [readCustomerBearer, async (request, res, next) => {
    const req = request as unknown as AuthenticatedMedusaRequest
    const contexts = [req.auth_context, req.session?.auth_context]
    for (const context of contexts) {
      if (context?.actor_type !== "customer") continue
      const pendingRegistration = !context.actor_id && context.auth_provider === "emailpass" &&
        /^\/store\/account\/?$/.test(req.originalUrl.split("?")[0])
      if (context.auth_provider !== "google" && !pendingRegistration &&
          (!context.actor_id || context.auth_provider !== "emailpass" || !hasEmailSignInProof(context.app_metadata))) {
        return res.status(401).json({ message: "Sign in again with an email code" })
      }
      if (!context.actor_id) continue
      try {
        // Bearer JWTs survive identity deletion cryptographically. Check the active account on every Store request.
        await req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER).retrieveCustomer(context.actor_id)
        await req.scope.resolve<IAuthModuleService>(Modules.AUTH).retrieveAuthIdentity(context.auth_identity_id)
      } catch (error) {
        if (error instanceof MedusaError && error.type === MedusaError.Types.NOT_FOUND) { res.status(401).json({ message: "Sign in again" }); return }
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
