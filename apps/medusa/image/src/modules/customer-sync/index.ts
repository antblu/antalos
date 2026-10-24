import { Module } from "@medusajs/framework/utils"
import CustomerSyncService from "./service"
export const CUSTOMER_SYNC = "customer_sync"
export default Module(CUSTOMER_SYNC, { service: CustomerSyncService })
