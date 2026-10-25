import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { deliverPasswordReset } from "../lib/account/security"
export default async function passwordReset({ event, container }: SubscriberArgs<{ email: string; locale: string }>) {
  await deliverPasswordReset(container, event.data.email, event.data.locale)
}
export const config: SubscriberConfig = { event: "account.password_reset_requested", context: { subscriberId: "account-password-reset", attempts: 10 } }
