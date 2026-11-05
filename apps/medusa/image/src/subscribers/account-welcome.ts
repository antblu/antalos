import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { drain } from "../lib/lifecycle/queue"
export default async function accountWelcome({ event, container }: SubscriberArgs<{ key: string }>) {
  await drain(container, event.data.key)
}
export const config: SubscriberConfig = { event: "account.welcome_requested", context: { subscriberId: "account-welcome", attempts: 10 } }
