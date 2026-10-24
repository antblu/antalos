import { MedusaService } from "@medusajs/framework/utils"
import { Identity } from "./models/identity"
import { Decision } from "./models/decision"
export default class CustomerSyncService extends MedusaService({ Identity, Decision }) {}
