import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import type { IAuthModuleService, ICustomerModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { identity, record, service } from "../lib/customer-sync/store"
type Input = { customerId: string; oldEmail: string; newEmail: string; providers: { id: string; entity_id: string }[] }
const authEmail = createStep("change-customer-auth-email", async (input: Input, { container }) => {
  if (input.providers.length) await container.resolve<IAuthModuleService>(Modules.AUTH).updateProviderIdentities(input.providers.map(p => ({ id: p.id, entity_id: input.newEmail })))
  return new StepResponse(input, input.providers)
}, async (providers, { container }) => { if (providers?.length) await container.resolve<IAuthModuleService>(Modules.AUTH).updateProviderIdentities(providers) })
const customerEmail = createStep("change-customer-profile-email", async (input: Input, { container }) => {
  await container.resolve<ICustomerModuleService>(Modules.CUSTOMER).updateCustomers(input.customerId, { email: input.newEmail })
  return new StepResponse(input, { id: input.customerId, email: input.oldEmail })
}, async (previous, { container }) => { if (previous) await container.resolve<ICustomerModuleService>(Modules.CUSTOMER).updateCustomers(previous.id, { email: previous.email }) })
const syncEmail = createStep("change-customer-sync-email", async (input: Input, { container }) => {
  const link = await identity(container, input.newEmail, input.customerId)
  return new StepResponse({ ...input, identityId: link.id }, { id: link.id, previousEmail: input.oldEmail })
}, async (previous, { container }) => {
  if (!previous) return
  if (previous.previousEmail) await service(container).updateIdentities({ id: previous.id, email: previous.previousEmail })
  else await service(container).deleteIdentities(previous.id)
})
const queueEmail = createStep("queue-customer-email-update", async (input: Input & { identityId: string }, { container }) => {
  await record(container, input.identityId, "profile", { event: "customer.email_verified" })
  return new StepResponse({ saved: true })
})
export const changeCustomerEmail = createWorkflow("change-customer-email", (input: Input) => {
  return new WorkflowResponse(queueEmail(syncEmail(customerEmail(authEmail(input)))))
})
