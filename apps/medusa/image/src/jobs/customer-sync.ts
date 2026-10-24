import type { MedusaContainer } from "@medusajs/framework/types"
import { drain } from "../lib/customer-sync/worker"
export default async function customerSync(c: MedusaContainer) { await drain(c) }
export const config = { name: "customer-sync-delivery", schedule: "* * * * *" }
