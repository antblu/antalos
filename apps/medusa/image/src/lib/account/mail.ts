import nodemailer from "nodemailer"
import { layout, escapeHtml } from "../lifecycle/templates"
export function mailConfigured() { return Boolean(process.env.ACCOUNT_SMTP_HOST && process.env.ACCOUNT_SMTP_USER && process.env.ACCOUNT_SMTP_PASSWORD && process.env.ACCOUNT_MAIL_FROM && process.env.CUSTOMER_STOREFRONT_URL) }
export async function sendAccountMail(to: string, subject: string, text: string) {
  if (!mailConfigured()) throw new Error("Account email delivery is unavailable")
  const from = process.env.ACCOUNT_MAIL_FROM!
  if (!/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(from) || /[\r\n]/.test(to)) throw new Error("Invalid email configuration")
  const port = Number(process.env.ACCOUNT_SMTP_PORT || 465)
  const transport = nodemailer.createTransport({ host: process.env.ACCOUNT_SMTP_HOST, port, secure: port === 465, requireTLS: true,
    auth: { user: process.env.ACCOUNT_SMTP_USER, pass: process.env.ACCOUNT_SMTP_PASSWORD }, tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000, logger: false, debug: false,
    disableFileAccess: true, disableUrlAccess: true,
  })
  try {
    // Keep account security's existing text and one-use link semantics; share
    // the brand frame without coupling transactional delivery to consent.
    const branded = process.env.EMAIL_LOGO_URL && process.env.SUPPORT_EMAIL
      ? layout(subject, `<p style="line-height:1.6">${escapeHtml(text).replace(/\n/g, "<br>")}</p>`, text) : { text }
    const result = await transport.sendMail({ from: { name: "EMILIANY", address: from }, to, subject, ...branded,
      headers: { "Auto-Submitted": "auto-generated" } })
    if (!result.accepted?.length) throw new Error("Email was not accepted")
  } catch { throw new Error("Account email could not be delivered") }
  finally { transport.close() }
}
export function storefrontLink(path: string, locale: unknown) {
  const origin = new URL(process.env.CUSTOMER_STOREFRONT_URL!)
  if (origin.protocol !== "https:" || origin.username || origin.password) throw new Error("A secure storefront origin is required")
  return new URL(`/${typeof locale === "string" && locale.startsWith("es") ? "es" : "en"}${path}`, origin.origin).href
}
