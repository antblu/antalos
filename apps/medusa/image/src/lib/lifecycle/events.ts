import type { MedusaContainer } from "@medusajs/framework/types"
import { enqueue } from "./queue"
import type { Kind, MailData, Order } from "./templates"
type Fulfillment = { metadata?: Record<string, unknown>; id: string; shipped_at?: string; delivered_at?: string; canceled_at?: string; provider_id?: string; labels?: { tracking_number: string; tracking_url?: string }[]; items?: { line_item_id?: string; quantity: number }[] }
type Payment = { id: string; provider_id: string; data?: Record<string, unknown>; refunds?: { id: string; amount: number }[]; payment_collection?: { order?: { id: string } } }
export async function handle(c: MedusaContainer, name: string, event: { id?: string; order_id?: string; fulfillment_id?: string; no_notification?: boolean }) {
  const query = c.resolve("query")
  let orderId = event.order_id || event.id, fulfillment: Fulfillment | undefined, payment: Payment | undefined
  if (name.startsWith("payment.")) {
    const result = await query.graph({ entity: "payment", fields: ["id", "provider_id", "data", "refunds.*", "payment_collection.order.id"], filters: { id: event.id } })
    payment = result.data[0] as unknown as Payment
    orderId = payment?.payment_collection?.order?.id
    // Capture can precede order creation. order.placed observes it later.
    if (!orderId) return
  } else if (name === "shipment.created" || name === "delivery.created") {
    const result = await query.graph({ entity: "fulfillment", fields: ["*", "labels.*", "items.*", "order.id"], filters: { id: event.id } })
    const f = result.data[0] as unknown as Fulfillment & { order?: { id: string } }
    fulfillment = f; orderId = f?.order?.id
    if (!orderId) throw new Error("Fulfillment order linkage unavailable")
  }
  if (!orderId) throw new Error("Lifecycle order missing")
  const result = await query.graph({ entity: "order", fields: ["id", "display_id", "email", "customer_id", "created_at", "currency_code", "status", "payment_status", "fulfillment_status", "total", "subtotal", "discount_total", "tax_total", "shipping_total", "shipping_tax_total", "shipping_address.*", "billing_address.*", "customer.first_name", "items.*", "fulfillments.*", "fulfillments.items.*", "fulfillments.labels.*"], filters: { id: orderId } })
  const order = result.data[0] as unknown as Order & { fulfillments?: Fulfillment[] }
  if (!order) throw new Error("Lifecycle order unavailable")
  const payload: MailData = { order }
  const queue = async (kind: Kind, entity: string, data: MailData = payload, email = true) => {
    if (email && order.email && !event.no_notification) await enqueue(c, "email", kind, entity, data)
    await enqueue(c, "odoo", kind, entity, data)
  }
  if (["order.placed", "payment.captured"].includes(name)) {
    // Authorization is not capture; never announce paid purchases early.
    if (["captured", "partially_refunded", "refunded"].includes(order.payment_status) && order.status !== "canceled") await queue("purchase", order.id)
  } else if (name === "order.canceled") await queue("cancellation", order.id)
  else if (name === "order.fulfillment_created") {
    // Preparing is optional to avoid redundant lifecycle mail.
    if (process.env.EMAIL_PROCESSING_ENABLED === "true") await queue("processing", order.id)
  } else if (fulfillment) {
    if (fulfillment.canceled_at) return
    const kind = name === "shipment.created" ? "shipping" : "delivery"
    if (kind === "shipping" && !fulfillment.shipped_at || kind === "delivery" && !fulfillment.delivered_at) throw new Error("Fulfillment state is not confirmed")
    const items = (fulfillment.items || []).map(f => { const item = order.items.find(i => i.id === f.line_item_id); return item ? { ...item, quantity: f.quantity } : undefined }).filter((i): i is NonNullable<typeof i> => !!i)
    if (!items.length) throw new Error("Shipment item mapping unavailable")
    await queue(kind, fulfillment.id, { order, items, tracking: (fulfillment.labels || []).map(l => ({ number: l.tracking_number, url: l.tracking_url, carrier: typeof fulfillment.metadata?.carrier === "string" ? fulfillment.metadata.carrier : undefined })) })
  } else if (name === "payment.refunded" && payment) {
    // Provider wrappers store only successful, provider-confirmed receipts.
    const receipts = payment.data?.confirmed_refunds as Record<string, { id: string; amount: number }> | undefined
    for (const receipt of Object.values(receipts || {})) {
      await queue("refund", `${payment.provider_id}:${receipt.id}`, { order, refund: { amount: receipt.amount, provider: payment.provider_id.includes("paypal") ? "PayPal" : "Stripe", partial: receipt.amount < Number(order.total) } })
    }
    if (!receipts) throw new Error("Refund confirmation requires a provider receipt")
  }
}
