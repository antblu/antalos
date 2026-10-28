export type Address = { first_name?: string | null; last_name?: string | null; address_1?: string | null; address_2?: string | null; city?: string | null; province?: string | null; postal_code?: string | null; country_code?: string | null }
export type Item = { id: string; title?: string; product_title?: string; variant_title?: string | null; variant_sku?: string | null; quantity: number; unit_price: number; total?: number; subtotal?: number; discount_total?: number; tax_total?: number; thumbnail?: string | null }
export type Order = { id: string; display_id: number; email: string; customer_id?: string | null; created_at: string; currency_code: string; status: string; payment_status: string; fulfillment_status?: string; total: number; subtotal: number; discount_total: number; tax_total: number; shipping_total: number; shipping_tax_total?: number; shipping_address?: Address | null; billing_address?: Address | null; customer?: { first_name?: string | null }; items: Item[]; metadata?: Record<string, unknown> }
export type Kind = "purchase" | "shipping" | "delivery" | "cancellation" | "refund" | "processing" | "shipping_update" | "out_for_delivery" | "contact"
export type MailData = { order: Order; items?: Item[]; tracking?: { number: string; url?: string; carrier?: string }[]; refund?: { amount: number; provider: string; partial: boolean }; ticket?: string; update?: string }
export const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
export function httpsUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return
  try { const u = new URL(value); if (u.protocol === "https:" && !u.username && !u.password) return u.href } catch { /* Omit invalid links. */ }
}
export function layout(title: string, body: string, text: string) {
  const store = httpsUrl(process.env.CUSTOMER_STOREFRONT_URL)
  const logo = httpsUrl(process.env.EMAIL_LOGO_URL)
  const support = process.env.SUPPORT_EMAIL || ""
  if (!store || !logo || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(support)) throw new Error("Email branding is not configured")
  return { text: `${text}\n\nWarmly,\nEmiliany™\n${store}\nContact: ${support}`, html: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body style="margin:0;background:#f3f4f0;color:#48591c;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff"><tr><td style="padding:28px"><a href="${escapeHtml(store)}"><img src="${escapeHtml(logo)}" width="104" alt="Emiliany" style="display:block;border:0;height:auto"></a><h1 style="font-family:Georgia,serif;font-size:26px;font-weight:normal">${escapeHtml(title)}</h1>${body}<p style="line-height:1.6">Warmly,<br>Emiliany™</p><hr style="border:0;border-top:1px solid #748249"><p style="font-size:13px;line-height:1.6"><a href="${escapeHtml(store)}" style="color:#48591c">Visit Emiliany</a><br>Need help? <a href="mailto:${escapeHtml(support)}" style="color:#48591c">${escapeHtml(support)}</a></p></td></tr></table></td></tr></table></body></html>` }
}
export function render(kind: Kind, data: MailData) {
  const o = data.order, money = (n: number) => new Intl.NumberFormat("en", { style: "currency", currency: o.currency_code }).format(Number(n))
  const titles: Record<Kind, string> = { purchase: "Your order is confirmed", shipping: "Your order has shipped", delivery: "Your order has been delivered", cancellation: "Your order has been canceled", refund: "Your refund is confirmed", processing: "We're preparing your order", shipping_update: "An update on your shipment", out_for_delivery: "Your order is out for delivery", contact: "We've received your message" }
  const descriptions: Record<Kind, string> = { purchase: "Thank you for your purchase. We've received your payment and are preparing your Emiliany jewelry.", shipping: "Your jewelry is on its way. Use the tracking information below to follow your package.", delivery: "Your shipment has been marked delivered. If you cannot find your package, please contact us.", cancellation: "Your order has been canceled. Any confirmed refund will be communicated separately.", refund: "Your payment provider has confirmed the refund below. Your bank or payment provider controls when it appears in your account.", processing: "We're preparing your jewelry for shipment.", shipping_update: data.update || "Your carrier has provided an update on your shipment.", out_for_delivery: "Your carrier reports that your package is out for delivery.", contact: "Thank you for contacting Emiliany. We've received your message and a member of our team will be in contact as soon as possible." }
  const title = titles[kind], reference = kind === "contact" ? data.ticket : String(o.display_id)
  const subject = `${title} — #${reference}`
  const first = o.customer?.first_name || o.shipping_address?.first_name || o.billing_address?.first_name
  const greeting = first ? `Hi ${first},` : "Hello,"
  const lines = [greeting, "", descriptions[kind], "", `${kind === "contact" ? "Request reference" : "Order"}: #${reference}`]
  let body = `<p>${escapeHtml(greeting)}</p><p style="line-height:1.6">${escapeHtml(descriptions[kind])}</p><p><strong>${kind === "contact" ? "Request reference" : "Order"}: #${escapeHtml(reference)}</strong></p>`
  if (kind === "purchase") { const date = new Date(o.created_at).toISOString().slice(0,10); lines.push(`Order date: ${date}`, "Payment: confirmed"); body += `<p>Order date: ${date}<br>Payment: confirmed</p>` }
  if (kind !== "contact") {
    body += '<table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse">'
    for (const item of data.items || o.items) {
      const name = item.product_title || item.title || "Jewelry", variant = item.variant_title && item.variant_title !== "Default" ? ` — ${item.variant_title}` : ""
      lines.push(`${name}${variant} × ${item.quantity} — ${money(item.unit_price)} each`)
      const image = httpsUrl(item.thumbnail)
      body += `<tr><td style="border-bottom:1px solid #748249">${image ? `<img src="${escapeHtml(image)}" alt="" width="48" style="height:auto"><br>` : ""}${escapeHtml(name + variant)}<br>Quantity: ${item.quantity}</td><td align="right" style="border-bottom:1px solid #748249">${escapeHtml(money(item.unit_price))} each</td></tr>`
    }
    body += "</table>"
  }
  if (kind === "purchase") {
    for (const [label, amount] of [["Subtotal", o.subtotal], ["Discounts", -o.discount_total], ["Tax", o.tax_total], ["Shipping", o.shipping_total], ["Total", o.total]] as const) { lines.push(`${label}: ${money(amount)}`); body += `<p>${label}: <strong>${escapeHtml(money(amount))}</strong></p>` }
  }
  if (data.refund) { const label = data.refund.partial ? "Partial refund" : "Full refund"; lines.push(`${label}: ${money(data.refund.amount)} (${data.refund.provider})`); body += `<p>${label}: <strong>${escapeHtml(money(data.refund.amount))}</strong> (${escapeHtml(data.refund.provider)})</p>` }
  if (o.shipping_address && ["purchase", "shipping", "delivery"].includes(kind)) {
    const a = o.shipping_address, address = [a.first_name, a.last_name].filter(Boolean).join(" ") + "\n" + [a.address_1, a.address_2, a.city, a.province, a.postal_code, a.country_code?.toUpperCase()].filter(Boolean).join("\n")
    lines.push("Shipping destination:", address); body += `<h2 style="font-size:18px">Shipping destination</h2><p>${escapeHtml(address).replace(/\n/g, "<br>")}</p>`
  }
  for (const tracking of data.tracking || []) {
    lines.push(`Carrier: ${tracking.carrier || "See tracking details"}`, `Tracking: ${tracking.number}`)
    body += `<p>Carrier: ${escapeHtml(tracking.carrier || "See tracking details")}<br>Tracking: ${escapeHtml(tracking.number)}</p>`
    const url = httpsUrl(tracking.url)
    if (url) { lines.push(url); body += `<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 20px;background:#48591c;color:#fff;text-decoration:none">Track your package</a></p>` }
  }
  return { subject, ...layout(title, body, lines.join("\n")) }
}
