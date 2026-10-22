import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import AntidProvider from "./service"

export default ModuleProvider(Modules.AUTH, { services: [AntidProvider] })
