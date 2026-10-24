import { timingSafeEqual } from "node:crypto"
import { authenticate, defineMiddlewares } from "@medusajs/framework/http"
export default defineMiddlewares({ routes: [
  { matcher: "/store/account", middlewares: [authenticate("customer", ["bearer"], { allowUnregistered: true })] },
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
