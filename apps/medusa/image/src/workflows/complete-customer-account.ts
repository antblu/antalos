import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows"
import { identity, record } from "../lib/customer-sync/store"
const saveAcceptance = createStep("save-account-acceptance", async (input: { customer_id: string; email: string; payload: Record<string, unknown> }, { container }) => {
  const link = await identity(container, input.email, input.customer_id)
  await record(container, link.id, "legal", { ...input.payload, customer_id: input.customer_id })
  return new StepResponse(input.customer_id)
})
export const completeCustomerAccount = createWorkflow("complete-customer-account", (input: { authIdentityId: string; customerData: { email: string; first_name?: string; last_name?: string }; payload: Record<string, unknown> }) => {
  const customer = createCustomerAccountWorkflow.runAsStep({ input: { authIdentityId: input.authIdentityId, customerData: input.customerData } })
  saveAcceptance({ customer_id: customer.id, email: customer.email, payload: input.payload })
  return new WorkflowResponse(customer)
})
