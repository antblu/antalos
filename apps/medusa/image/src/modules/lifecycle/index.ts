import { Module } from "@medusajs/framework/utils"
import LifecycleService from "./service"
export const LIFECYCLE = "lifecycle"
export default Module(LIFECYCLE, { service: LifecycleService })
