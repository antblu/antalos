import type { MedusaContainer, IOrderModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type OdooModuleService from "../../modules/odoo/service"
import { ODOO_MODULE } from "../../modules/odoo"
import type { Kind, MailData } from "./templates"
export async function exportOrder(c: MedusaContainer, key: string, kind: Kind, payload: MailData) {
  const odoo = c.resolve<OdooModuleService>(ODOO_MODULE)
  // Atomic remote operation owns unique order/event constraints, SKU checks,
  // tax/total validation and refund audit. Never issues a processor refund.
  const id = await odoo.execute<number>("sale.order", "medusa_sync", [key, kind, payload])
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Odoo returned no order mapping")
  const orders = c.resolve<IOrderModuleService>(Modules.ORDER)
  const current = await orders.retrieveOrder(payload.order.id)
  await orders.updateOrders(payload.order.id, { metadata: { ...current.metadata, odoo_order_id: id } })
  return id
}
