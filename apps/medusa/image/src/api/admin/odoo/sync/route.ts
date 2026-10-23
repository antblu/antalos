import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { syncOdooProducts } from "../../../../lib/sync-odoo-products"

// Medusa applies administrator authentication to /admin routes by default.
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  return res.json(await syncOdooProducts(req.scope))
}
