import { Module } from "@medusajs/framework/utils"
import OdooModuleService from "./service"

export const ODOO_MODULE = "odoo"
export default Module(ODOO_MODULE, { service: OdooModuleService })
