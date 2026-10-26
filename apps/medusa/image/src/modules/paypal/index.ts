import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import PayPalProvider from "./service"

export default ModuleProvider(Modules.PAYMENT, { services: [PayPalProvider] })
