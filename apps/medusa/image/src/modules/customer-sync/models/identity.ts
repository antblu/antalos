import { model } from "@medusajs/framework/utils"
export const Identity = model.define("sync_identity", {
  id: model.id().primaryKey(),
  email: model.text().unique(),
  customer_id: model.text().unique().nullable(),
  odoo_id: model.number().unique().nullable(),
  mautic_id: model.number().unique().nullable(),
})
