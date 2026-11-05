import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { drain } from "../lib/customer-sync/worker"
export default async function newsletterWelcome({ event, container }: SubscriberArgs<{ identity_id: string }>) {
  await drain(container, event.data.identity_id)
}
export const config: SubscriberConfig = { event: "newsletter.welcome_requested", context: { subscriberId: "newsletter-welcome", attempts: 10 } }
