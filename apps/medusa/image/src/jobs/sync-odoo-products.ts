import type { Logger, MedusaContainer } from "@medusajs/framework/types"
import { syncOdooProducts } from "../lib/sync-odoo-products"
import { ODOO_MODULE } from "../modules/odoo"
import type OdooModuleService from "../modules/odoo/service"

export default async function syncOdooProductsJob(container: MedusaContainer) {
  if (!container.resolve<OdooModuleService>(ODOO_MODULE).enabled) return
  const logger = container.resolve<Logger>("logger")
  logger.info("Starting Odoo product sync")
  const result = await syncOdooProducts(container)
  logger.info(`Odoo product sync completed: ${result.synced} products`)
}

export const config = { name: "sync-odoo-products", schedule: "0 0 * * *" }
