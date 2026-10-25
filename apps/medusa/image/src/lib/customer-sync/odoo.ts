import type OdooModuleService from "../../modules/odoo/service"
export type Partner = { id: number; name: string; email: string; phone?: string | false; lang?: string | false; country_id?: [number, string] | false; x_medusa_customer_id?: string | false; x_marketing_consent?: boolean }
export async function upsertPartner(odoo: OdooModuleService, data: Record<string, unknown>, linked?: number | null) {
  const customerId = String(data.x_medusa_customer_id)
  const matches = await odoo.execute<Partner[]>("res.partner", "search_read", [["|", ["x_medusa_customer_id", "=", customerId], ["email", "=ilike", data.email]]], { fields: ["id", "email", "x_medusa_customer_id"], limit: 3 })
  if (matches.length > 1) throw new Error("Ambiguous Odoo partner requires review")
  const partner = matches[0]
  if (partner?.x_medusa_customer_id && partner.x_medusa_customer_id !== customerId) throw new Error("Odoo customer linkage conflict")
  if (linked && partner && linked !== partner.id) throw new Error("Odoo partner linkage conflict")
  const id = linked || partner?.id
  if (id) { await odoo.execute("res.partner", "write", [[id], data]); return id }
  return odoo.execute<number>("res.partner", "create", [data])
}
export async function partners(odoo: OdooModuleService, after = 0) {
  // Login-linked partners remain visible to identity matching, but are not
  // customer imports and cannot be updated by the integration's record rules.
  return odoo.execute<Partner[]>("res.partner", "search_read", [[["id", ">", after], ["email", "!=", false], ["active", "=", true], ["user_ids", "=", false]]], {
    fields: ["id", "name", "email", "phone", "lang", "country_id", "x_medusa_customer_id"], limit: 100, order: "id asc",
  })
}

export type CustomerAddress = { id?: string; first_name?: string | null; last_name?: string | null; company?: string | null; phone?: string | null; province?: string | null; address_1?: string | null; address_2?: string | null; city?: string | null; postal_code?: string | null; country_code?: string | null; is_default_billing?: boolean; is_default_shipping?: boolean }
export async function upsertAddresses(odoo: OdooModuleService, partnerId: number, addresses: CustomerAddress[]) {
  for (const address of addresses) {
    if (!address.id) continue
    const matches = await odoo.execute<{ id: number }[]>("res.partner", "search_read", [[["x_medusa_address_id", "=", address.id]]], { fields: ["id"], limit: 2 })
    if (matches.length > 1) throw new Error("Odoo address linkage conflict")
    const values: Record<string, unknown> = { parent_id: partnerId, x_medusa_address_id: address.id, type: address.is_default_billing ? "invoice" : "delivery", name: [address.first_name, address.last_name].filter(Boolean).join(" ") || (address.is_default_billing ? "Billing" : "Shipping"), phone: address.phone || false, company_name: address.company || false, state_id: false, street: address.address_1 || false, street2: address.address_2 || false, city: address.city || false, zip: address.postal_code || false }
    if (address.country_code) {
      const countries = await odoo.execute<{ id: number }[]>("res.country", "search_read", [[["code", "=", address.country_code.toUpperCase()]]], { fields: ["id"], limit: 1 })
      if (countries[0]) {
        values.country_id = countries[0].id
        if (address.province) {
          const states = await odoo.execute<{ id: number }[]>("res.country.state", "search_read", [[["country_id", "=", countries[0].id], "|", ["code", "=ilike", address.province], ["name", "=ilike", address.province]]], { fields: ["id"], limit: 2 })
          if (states.length === 1) values.state_id = states[0].id
        }
      }
    }
    if (matches[0]) await odoo.execute("res.partner", "write", [[matches[0].id], values])
    else await odoo.execute("res.partner", "create", [values])
  }
}
