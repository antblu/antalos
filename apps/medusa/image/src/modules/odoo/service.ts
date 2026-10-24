import { randomUUID } from "node:crypto"

type Options = {
  enabled?: boolean
  contactsEnabled?: boolean
  url?: string
  dbName?: string
  username?: string
  apiKey?: string
}
type Relation = [number, string]
type Template = {
  id: number
  name: string
  description_sale: string | false
  active: boolean
  sale_ok: boolean
  is_published?: boolean
  currency_id: Relation
  product_variant_ids: number[]
}
type Variant = {
  id: number
  name: string
  active: boolean
  default_code: string | false
  lst_price: number
  product_template_attribute_value_ids: number[]
}
type AttributeValue = { id: number; name: string; attribute_id: Relation }
export type OdooProduct = Template & {
  currency: string
  variants: (Variant & { options: Record<string, string> })[]
}

// Odoo 19 still supports the recipe's JSON-RPC API. Native fetch keeps the
// transport bounded and avoids another client dependency or logging credentials.
export default class OdooModuleService {
  private uid?: number
  private templateFields?: Record<string, unknown>
  readonly enabled: boolean
  readonly contactsEnabled: boolean

  constructor(_container: Record<string, unknown>, private options: Options) {
    this.contactsEnabled = options.contactsEnabled === true
    this.enabled = options.enabled === true
    if ((this.enabled || this.contactsEnabled) && (!options.url || !options.dbName || !options.username || !options.apiKey)) {
      throw new Error("Odoo sync requires ODOO_URL, ODOO_DB_NAME, ODOO_USERNAME and ODOO_API_KEY")
    }
  }

  private async rpc<T>(service: string, method: string, args: unknown[]): Promise<T> {
    if (!this.enabled && !this.contactsEnabled) throw new Error("Odoo product sync is disabled")
    const id = randomUUID()
    let response: Response
    try {
      response = await fetch(`${this.options.url!.replace(/\/$/, "")}/jsonrpc`, {
        method: "POST",
        redirect: "error",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id, method: "call", params: { service, method, args } }),
        signal: AbortSignal.timeout(30_000),
      })
    } catch {
      throw new Error("Odoo RPC transport failed or timed out")
    }
    if (!response.ok) throw new Error(`Odoo RPC returned HTTP ${response.status}`)
    let payload: { id?: string; result?: T; error?: unknown }
    try {
      payload = await response.json()
    } catch {
      throw new Error("Odoo RPC returned invalid JSON")
    }
    // Odoo fault data can include call arguments and the key. Never propagate it.
    if (payload.id !== id || payload.error || !("result" in payload)) {
      this.uid = undefined
      throw new Error("Odoo RPC failed; review account access and server logs privately")
    }
    return payload.result as T
  }

  async execute<T>(model: string, method: string, args: unknown[], kwargs = {}): Promise<T> {
    if (!this.uid) {
      const uid = await this.rpc<number | false>("common", "authenticate", [
        this.options.dbName, this.options.username, this.options.apiKey, {},
      ])
      if (typeof uid !== "number" || !Number.isSafeInteger(uid) || uid <= 0) {
        throw new Error("Odoo integration authentication failed")
      }
      this.uid = uid
    }
    return this.rpc<T>("object", "execute_kw", [
      this.options.dbName, this.uid, this.options.apiKey, model, method, args, kwargs,
    ])
  }

  private async read<T>(model: string, ids: number[], fields: string[]): Promise<T[]> {
    if (!ids.length) return []
    return this.execute<T[]>(model, "read", [[...new Set(ids)]], {
      fields, context: { active_test: false },
    })
  }

  async listProducts(afterId = 0, limit = 50): Promise<OdooProduct[]> {
    this.templateFields ||= await this.execute<Record<string, unknown>>(
      "product.template", "fields_get", [], { attributes: ["type"] },
    )
    // website_sale is optional. Missing publication fields mean draft imports.
    const fields = ["id", "name", "description_sale", "active", "sale_ok", "currency_id", "product_variant_ids"]
    if ("is_published" in this.templateFields) fields.push("is_published")
    const templates = await this.execute<Template[]>("product.template", "search_read", [
      [["id", ">", afterId]],
    ], { fields, limit, order: "id asc", context: { active_test: false } })
    const variants = await this.read<Variant>("product.product", templates.flatMap((p) => p.product_variant_ids), [
      "id", "name", "active", "default_code", "lst_price", "product_template_attribute_value_ids",
    ])
    const values = await this.read<AttributeValue>("product.template.attribute.value",
      variants.flatMap((v) => v.product_template_attribute_value_ids), ["id", "name", "attribute_id"])
    const currencies = await this.read<{ id: number; name: string }>("res.currency",
      templates.map((p) => p.currency_id[0]), ["id", "name"])
    const byVariant = new Map(variants.map((v) => [v.id, v]))
    const byValue = new Map(values.map((v) => [v.id, v]))
    return templates.map((product) => {
      const currency = currencies.find((c) => c.id === product.currency_id[0])?.name.toLowerCase()
      if (!currency || !/^[a-z]{3}$/.test(currency)) throw new Error(`Invalid currency on Odoo product ${product.id}`)
      return {
        ...product, currency,
        variants: product.product_variant_ids.map((id) => {
          const variant = byVariant.get(id)
          if (!variant) throw new Error(`Odoo variant ${id} is inaccessible`)
          const options: Record<string, string> = {}
          for (const valueId of variant.product_template_attribute_value_ids) {
            const value = byValue.get(valueId)
            if (!value) throw new Error(`Odoo attribute value ${valueId} is inaccessible`)
            options[value.attribute_id[1]] = value.name
          }
          return { ...variant, options: Object.keys(options).length ? options : { Default: "Default" } }
        }).filter((v) => !product.active || v.active),
      }
    })
  }
}
