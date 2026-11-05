import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows"
import { identity, record } from "../lib/customer-sync/store"
import { enqueueAccountWelcome } from "../lib/lifecycle/queue"
import { Modules } from "@medusajs/framework/utils"
import type { IEventBusModuleService } from "@medusajs/framework/types"
const saveAcceptance = createStep("save-account-acceptance", async (input: { customer_id: string; email: string; payload: Record<string, unknown> }, { container }) => {
  const link = await identity(container, input.email, input.customer_id)
  await record(container, link.id, "legal", { ...input.payload, customer_id: input.customer_id })
  try {
    const key = await enqueueAccountWelcome(container, input.customer_id, { email: input.email, locale: input.payload.locale === "es" ? "es" : "en" })
    await container.resolve<IEventBusModuleService>(Modules.EVENT_BUS).emit({ name: "account.welcome_requested", data: { key } })
  }
  catch { container.resolve("logger").warn("account.welcome_delivery_deferred") }
  return new StepResponse(input.customer_id)
})
export const completeCustomerAccount = createWorkflow("complete-customer-account", (input: { authIdentityId: string; customerData: { email: string; first_name?: string; last_name?: string }; payload: Record<string, unknown> }) => {
  const customer = createCustomerAccountWorkflow.runAsStep({ input: { authIdentityId: input.authIdentityId, customerData: input.customerData } })
  saveAcceptance({ customer_id: customer.id, email: customer.email, payload: input.payload })
  return new WorkflowResponse(customer)
})
