import type { ILockingModule, MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { ODOO_MODULE } from "../modules/odoo"
import type OdooModuleService from "../modules/odoo/service"
import { syncFromOdooWorkflow } from "../workflows/sync-from-odoo"

export async function syncOdooProducts(container: MedusaContainer) {
  if (!container.resolve<OdooModuleService>(ODOO_MODULE).enabled) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Odoo product sync is disabled")
  }
  const locking = container.resolve<ILockingModule>(Modules.LOCKING)
  return locking.execute("odoo-product-sync", async (signal) => {
    let after_id = 0
    let total = 0
    const limit = 50
    while (true) {
      signal?.throwIfAborted()
      const { result } = await syncFromOdooWorkflow(container).run({ input: { after_id, limit } })
      total += result.count
      if (result.count < limit) return { synced: total }
      after_id = result.after_id
    }
  }, { timeout: 1, expire: 120 })
}
