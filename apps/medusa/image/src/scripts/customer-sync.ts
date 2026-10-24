import type { ExecArgs } from "@medusajs/framework/types"
import { Mautic } from "../lib/customer-sync/mautic"
import { reconcile, drain } from "../lib/customer-sync/worker"
import { locked } from "../lib/customer-sync/store"
export default async function customerSync({ container, args }: ExecArgs) {
  if (args.includes("--provision")) await new Mautic().provision()
  const result = await locked(container, "reconcile", () => reconcile(container))
  const delivery = await drain(container)
  container.resolve("logger").info(JSON.stringify({ event: "customer_sync.summary", reconciliation: result, delivery }))
}
