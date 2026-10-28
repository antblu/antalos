import { model } from "@medusajs/framework/utils"
export const LifecycleEvent = model.define("lifecycle_event", {
  id: model.id().primaryKey(),
  key: model.text(),
  channel: model.enum(["email", "odoo"]),
  kind: model.text(),
  order_id: model.text(),
  payload: model.json(),
  status: model.enum(["pending", "sending", "sent", "retrying", "review"]).default("pending"),
  attempts: model.number().default(0),
  available_at: model.dateTime(),
  sent_at: model.dateTime().nullable(),
  provider_id: model.text().nullable(),
  failure: model.text().nullable(),
}).indexes([{ on: ["key"], unique: true }])
