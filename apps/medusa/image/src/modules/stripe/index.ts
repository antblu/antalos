import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import * as providers from "@medusajs/payment-stripe/dist/services"
import ConfirmedStripeProvider from "./service"
// Retain every bundled identifier so existing regional provider IDs remain valid.
export default ModuleProvider(Modules.PAYMENT, { services: Object.values(providers).map(provider => provider === providers.StripeProviderService ? ConfirmedStripeProvider : provider) })
