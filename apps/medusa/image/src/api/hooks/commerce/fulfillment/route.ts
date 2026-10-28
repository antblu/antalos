import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ILockingModule, IFulfillmentModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createOrderShipmentWorkflow, markOrderFulfillmentAsDeliveredWorkflow } from "@medusajs/medusa/core-flows"
import { verifyFulfillmentSignature } from "../../../../lib/lifecycle/signature"
import { handle } from "../../../../lib/lifecycle/events"
import { httpsUrl } from "../../../../lib/lifecycle/templates"
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const raw = (req as unknown as { rawBody?: Buffer }).rawBody
  if (!raw || !verifyFulfillmentSignature(raw, req.headers["x-commerce-timestamp"], req.headers["x-commerce-signature"], process.env.FULFILLMENT_WEBHOOK_SECRET)) { res.status(401).json({ message: "Invalid signature" }); return }
  const b = req.body as Record<string, unknown>
  if (!b || typeof b.order_id !== "string" || !/^order_[\w-]+$/.test(b.order_id) || typeof b.fulfillment_id !== "string" || !/^ful_[\w-]+$/.test(b.fulfillment_id) || !["shipped", "delivered"].includes(String(b.status))) { res.status(422).json({ message: "Invalid fulfillment event" }); return }
  if (b.carrier !== undefined && (typeof b.carrier !== "string" || b.carrier.length > 100 || /[\r\n]/.test(b.carrier))) { res.status(422).json({ message: "Invalid carrier" }); return }
  const orderId = b.order_id, fulfillmentId = b.fulfillment_id
  const labels = Array.isArray(b.labels) ? b.labels as { tracking_number: string; tracking_url: string; label_url?: string }[] : []
  if (labels.length > 20 || labels.some(l => !l || typeof l.tracking_number !== "string" || l.tracking_number.length > 200 || !httpsUrl(l.tracking_url) || l.label_url && !httpsUrl(l.label_url))) { res.status(422).json({ message: "Invalid tracking information" }); return }
  await req.scope.resolve<ILockingModule>(Modules.LOCKING).execute(`commerce-fulfillment:${fulfillmentId}`, async () => {
    const { data } = await req.scope.resolve("query").graph({ entity: "fulfillment", fields: ["id", "order.id", "shipped_at", "delivered_at", "canceled_at", "metadata", "items.line_item_id", "items.quantity"], filters: { id: fulfillmentId } })
    const f = data[0]
    if (!f || f.order?.id !== orderId || f.canceled_at) { res.status(409).json({ message: "Fulfillment mapping requires review" }); return }
    if (typeof b.carrier === "string" && b.carrier && !f.shipped_at) await req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT).updateFulfillment(fulfillmentId, { metadata: { ...f.metadata, carrier: b.carrier } })
    if (b.status === "shipped" && !f.shipped_at) {
      if (!labels.length || !f.items?.length || f.items.some(i => !i.line_item_id)) { res.status(422).json({ message: "Mapped shipment items and tracking are required" }); return }
      await createOrderShipmentWorkflow(req.scope).run({ input: { order_id: orderId, fulfillment_id: fulfillmentId, items: f.items.map(i => ({ id: i.line_item_id!, quantity: Number(i.quantity) })), labels: labels.map(l => ({ tracking_number: l.tracking_number, tracking_url: l.tracking_url, label_url: l.label_url || "" })) } })
    }
    if (b.status === "delivered" && !f.delivered_at) {
      if (!f.shipped_at) { res.status(409).json({ message: "Shipment must be recorded before delivery" }); return }
      await markOrderFulfillmentAsDeliveredWorkflow(req.scope).run({ input: { orderId, fulfillmentId } })
    }
    // Replay repairs a lost subscriber delivery; unique event keys prevent mail duplication.
    await handle(req.scope, b.status === "shipped" ? "shipment.created" : "delivery.created", { id: fulfillmentId })
    res.json({ accepted: true })
  }, { timeout: 10, expire: 120 })
}
