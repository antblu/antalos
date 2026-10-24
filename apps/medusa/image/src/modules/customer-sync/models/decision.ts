import { model } from "@medusajs/framework/utils"
// Immutable decision payload doubles as a durable outbox; only delivery fields change.
export const Decision = model.define("sync_decision", {
  id: model.id().primaryKey(),
  identity_id: model.text(),
  revision: model.number(),
  kind: model.enum(["legal", "marketing", "profile"]),
  payload: model.json(),
  delivered: model.boolean().default(false),
  attempts: model.number().default(0),
  available_at: model.dateTime(),
  failure: model.text().nullable(),
})
