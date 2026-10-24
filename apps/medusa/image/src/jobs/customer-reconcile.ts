import type { MedusaContainer } from "@medusajs/framework/types"
import { reconcile } from "../lib/customer-sync/worker"
import { locked } from "../lib/customer-sync/store"
export default async function customerReconcile(c: MedusaContainer) {
  if (process.env.CUSTOMER_SYNC_ENABLED === "true") await locked(c, "reconcile", () => reconcile(c))
}
// Reconciliation is a repair/import fallback and observes Odoo changes, which
// has no outbound webhook module installed. Medusa delivery is event-driven.
export const config = { name: "customer-sync-reconcile", schedule: "*/15 * * * *" }
