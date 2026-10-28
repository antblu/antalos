import type { MedusaContainer } from "@medusajs/framework/types"
import { drain } from "../lib/lifecycle/queue"
export default async function lifecycle(c: MedusaContainer) { await drain(c) }
export const config = { name: "lifecycle-delivery", schedule: "* * * * *" }
