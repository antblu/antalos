import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { enqueueCustomer } from "../lib/customer-sync/worker"
export default async function customerSync({ event, container }: SubscriberArgs<{ id: string; customer_id?: string; order_id?: string }>) {
  if (process.env.CUSTOMER_SYNC_ENABLED !== "true") return
  if (event.name === "customer.created" || event.name === "customer.updated") return enqueueCustomer(container, event.data.id, event.name)
  const query = container.resolve("query")
  if (event.name.startsWith("payment.")) {
    const { data: payments } = await query.graph({ entity: "payment", fields: ["payment_collection.order.id", "payment_collection.order.customer_id"], filters: { id: event.data.id } })
    const order = payments[0]?.payment_collection?.order
    if (order?.customer_id) await enqueueCustomer(container, order.customer_id, event.name)
    return
  }
  const { data } = await query.graph({ entity: "order", fields: ["customer_id"], filters: { id: event.data.order_id || event.data.id } })
  if (data[0]?.customer_id) await enqueueCustomer(container, data[0].customer_id, event.name)
}
export const config: SubscriberConfig = { event: ["customer.created", "customer.updated", "order.placed", "payment.captured", "order.fulfillment_created", "order.canceled", "payment.refunded"], context: { subscriberId: "customer-sync", attempts: 10 } }
