import { json } from "./transport"
export type Contact = { id: number; fields?: { all?: Record<string, unknown> }; doNotContact?: { channel: string; reason: number; dateAdded?: string }[] }
export class Mautic {
  private url = process.env.MAUTIC_URL?.replace(/\/$/, "")
  async request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    if (!this.url || !process.env.MAUTIC_API_USERNAME || !process.env.MAUTIC_API_PASSWORD) throw new Error("Mautic API configuration missing")
    return json<T>("mautic", `${this.url}/api/${path}`, { method, headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.MAUTIC_API_USERNAME}:${process.env.MAUTIC_API_PASSWORD}`).toString("base64")}`,
      "content-type": "application/json",
    }, ...(body ? { body: JSON.stringify(body) } : {}) })
  }
  async find(field: string, value: string): Promise<Contact | undefined> {
    const result = await this.request<{ contacts: Record<string, Contact> }>(`contacts?${new URLSearchParams({ search: `${field}:${JSON.stringify(value)}`, limit: "5" })}`)
    const contacts = Object.values(result.contacts || {}).filter(c => String(c.fields?.all?.[field] ?? "").toLowerCase() === value.toLowerCase())
    if (contacts.length > 1) throw new Error("Ambiguous Mautic identity requires review")
    return contacts[0]
  }
  async resolve(email: string, customerId?: string | null, odooId?: number | null, id?: number | null) {
    const linked = id ? (await this.request<{ contact: Contact }>(`contacts/${id}`)).contact : undefined
    const customer = customerId ? await this.find("medusa_customer_id", customerId) : undefined
    const odoo = odooId ? await this.find("odoo_partner_id", String(odooId)) : undefined
    const mail = await this.find("email", email)
    const selected = linked || customer || odoo || mail
    if ([linked, customer, odoo, mail].some(c => c && selected && c.id !== selected.id)) throw new Error("Mautic linkage conflict requires review")
    return selected
  }
  async save(contact: Contact | undefined, fields: Record<string, unknown>) {
    return (await this.request<{ contact: Contact }>(contact ? `contacts/${contact.id}/edit` : "contacts/new", contact ? "PATCH" : "POST", fields)).contact
  }
  async segment(alias: string) {
    const result = await this.request<{ lists: Record<string, { id: number; alias: string }> }>(`segments?${new URLSearchParams({ search: alias, limit: "100" })}`)
    const segment = Object.values(result.lists || {}).find(s => s.alias === alias)
    if (!segment) throw new Error("Mautic segments have not been provisioned")
    return segment.id
  }
  async membership(alias: string, id: number, add: boolean) {
    const segment = await this.segment(alias)
    await this.request(`segments/${segment}/contact/${id}/${add ? "add" : "remove"}`, "POST", {})
  }
  async provision() {
    const definitions: Record<string, string> = {
      medusa_customer_id: "text", odoo_partner_id: "number", customer_source: "text", customer_type: "text",
      preferred_language: "text", marketing_consent: "boolean", marketing_consent_date: "datetime",
      marketing_consent_source: "text", newsletter_subscriber: "boolean", last_order_date: "datetime",
      order_count: "number", lifetime_value: "text", last_product: "text", last_category: "text", last_commerce_event: "text",
    }
    const fields = await this.request<{ fields: Record<string, { alias: string }> }>("fields/contact?limit=1000")
    const aliases = new Set(Object.values(fields.fields || {}).map(f => f.alias))
    for (const [alias, type] of Object.entries(definitions)) if (!aliases.has(alias)) {
      await this.request("fields/contact/new", "POST", { label: alias.replaceAll("_", " "), alias, type, group: "core", isPublished: true, isPubliclyUpdatable: false, isUniqueIdentifier: ["medusa_customer_id", "odoo_partner_id"].includes(alias) })
    }
    for (const [alias, name] of Object.entries({ "emiliany-newsletter": "EMILIANY Newsletter", "emiliany-medusa-customers": "EMILIANY Medusa Customers", "emiliany-odoo-customers": "EMILIANY Odoo Customers" })) {
      const result = await this.request<{ lists: Record<string, { alias: string }> }>(`segments?search=${alias}&limit=100`)
      if (!Object.values(result.lists || {}).some(s => s.alias === alias)) await this.request("segments/new", "POST", { name, alias, isPublished: true, isGlobal: true })
    }
  }
}
