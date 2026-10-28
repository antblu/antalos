import type { ILockingModule, Logger, MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { LIFECYCLE } from "../../modules/lifecycle"
import type LifecycleService from "../../modules/lifecycle/service"
import { render, type Kind, type MailData } from "./templates"
import { sendMail, DeliveryError } from "./mail"
import { exportOrder } from "./odoo"
const service = (c: MedusaContainer) => c.resolve<LifecycleService>(LIFECYCLE)
export async function enqueue(c: MedusaContainer, channel: "email" | "odoo", kind: Kind, entity: string, payload: MailData) {
  const key = `${channel}:${kind}:${entity}`
  await c.resolve<ILockingModule>(Modules.LOCKING).execute(`lifecycle:${key}`, async () => {
    if ((await service(c).listLifecycleEvents({ key }))[0]) return
    await service(c).createLifecycleEvents({ key, channel, kind, order_id: payload.order.id, payload: JSON.parse(JSON.stringify(payload)), available_at: new Date() })
  }, { timeout: 10, expire: 30 })
}
export async function drain(c: MedusaContainer) {
  const s = service(c), logger = c.resolve<Logger>("logger")
  const tasks = await s.listLifecycleEvents({ status: ["pending", "retrying", "sending"], available_at: { $lte: new Date() } }, { take: 50, order: { created_at: "ASC" } })
  for (const task of tasks) {
    await c.resolve<ILockingModule>(Modules.LOCKING).execute(`lifecycle:${task.key}`, async () => {
      const current = await s.retrieveLifecycleEvent(task.id)
      if (["sent", "review"].includes(current.status) || new Date(current.available_at).getTime() > Date.now()) return
      if (current.channel === "email" && process.env.TRANSACTIONAL_EMAIL_ENABLED !== "true") return
      if (current.channel === "odoo" && process.env.ODOO_ORDER_SYNC_ENABLED !== "true") return
      if (current.status === "sending" && current.channel === "email") {
        await s.updateLifecycleEvents({ id: current.id, status: "review", failure: "interrupted_smtp_delivery" }); return
      }
      const attempts = current.attempts + 1
      // Persist before the external side effect. A crashed SMTP send is never
      // blindly retried; Odoo's atomic remote upsert permits safe replay.
      await s.updateLifecycleEvents({ id: current.id, status: "sending", attempts, available_at: new Date(Date.now() + 600000) })
      let delivered = false
      try {
        const payload = current.payload as unknown as MailData
        let providerId: string
        if (current.channel === "email") providerId = await sendMail(current.key, payload.order.email, render(current.kind as Kind, payload))
        else providerId = String(await exportOrder(c, current.key, current.kind as Kind, payload))
        delivered = true
        await s.updateLifecycleEvents({ id: current.id, status: "sent", sent_at: new Date(), provider_id: providerId, failure: null })
        logger.info(JSON.stringify({ event: "lifecycle.delivered", channel: current.channel, kind: current.kind, event_id: current.id, provider_id: providerId }))
      } catch (error) {
        const retry = current.channel === "odoo" || (!delivered && error instanceof DeliveryError && error.retryable)
        await s.updateLifecycleEvents({ id: current.id, status: retry ? "retrying" : "review", failure: delivered ? "delivery_receipt_write_failed" : retry ? "provider_unavailable" : "delivery_requires_review", available_at: new Date(Date.now() + Math.min(86400000, 30000 * 2 ** Math.min(attempts, 12))) })
        logger.warn(JSON.stringify({ event: "lifecycle.delivery_failed", event_id: current.id, channel: current.channel, attempts, retryable: retry }))
      }
    }, { timeout: 1, expire: 180 }).catch(() => { logger.warn(JSON.stringify({ event: "lifecycle.lock_or_storage_unavailable", event_id: task.id })) })
  }
}
