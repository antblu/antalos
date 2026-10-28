import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { handle } from "../lib/lifecycle/events"
export default async function lifecycle({ event, container }: SubscriberArgs<{ id?: string; order_id?: string; fulfillment_id?: string; no_notification?: boolean }>) { await handle(container, event.name, event.data) }
export const config: SubscriberConfig = { event: ["order.placed", "payment.captured", "order.canceled", "order.fulfillment_created", "shipment.created", "delivery.created", "payment.refunded"], context: { subscriberId: "commerce-lifecycle", attempts: 10 } }
