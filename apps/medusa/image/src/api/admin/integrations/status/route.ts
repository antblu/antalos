import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { LIFECYCLE } from "../../../../modules/lifecycle"
import type LifecycleService from "../../../../modules/lifecycle/service"
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // Medusa's /admin authentication applies; never expose recipient/payload data.
  const service = req.scope.resolve<LifecycleService>(LIFECYCLE)
  const counts: Record<string, number> = {}
  for (const status of ["pending", "sending", "sent", "retrying", "review"] as const) {
    const [, count] = await service.listAndCountLifecycleEvents({ status }, { take: 1 })
    counts[status] = count
  }
  res.json({ queue: counts, enabled: { email: process.env.TRANSACTIONAL_EMAIL_ENABLED === "true", odoo_orders: process.env.ODOO_ORDER_SYNC_ENABLED === "true", customers: process.env.CUSTOMER_SYNC_ENABLED === "true", stripe: process.env.STRIPE_ENABLED === "true", paypal: process.env.PAYPAL_ENABLED === "true" }, note: "Configuration and queue state only; this endpoint does not certify external delivery." })
}
