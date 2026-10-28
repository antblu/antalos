import nodemailer from "nodemailer"
import { createHash } from "node:crypto"
export class DeliveryError extends Error {
  constructor(public readonly retryable: boolean) { super("Transactional email delivery failed") }
}
export function transport() {
  if (!process.env.ACCOUNT_SMTP_HOST || !process.env.ACCOUNT_SMTP_USER || !process.env.ACCOUNT_SMTP_PASSWORD) throw new DeliveryError(true)
  const port = Number(process.env.ACCOUNT_SMTP_PORT || 465)
  return nodemailer.createTransport({ host: process.env.ACCOUNT_SMTP_HOST, port, secure: port === 465, requireTLS: true,
    auth: { user: process.env.ACCOUNT_SMTP_USER, pass: process.env.ACCOUNT_SMTP_PASSWORD }, tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000, logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true })
}
export async function sendMail(key: string, to: string, content: { subject: string; text: string; html: string }) {
  const from = process.env.ACCOUNT_MAIL_FROM || ""
  const email = /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/
  if (!email.test(from) || !email.test(to)) throw new DeliveryError(false)
  const replyTo = process.env.EMAIL_REPLY_TO || process.env.SUPPORT_EMAIL
  if (replyTo && !email.test(replyTo)) throw new DeliveryError(false)
  const smtp = transport()
  try {
    const result = await smtp.sendMail({ from: { name: "Emiliany", address: from }, to, replyTo, ...content,
      messageId: `<${createHash("sha256").update(key).digest("hex")}@${from.split("@")[1]}>`, headers: { "Auto-Submitted": "auto-generated" } })
    if (!result.accepted?.length) throw new DeliveryError(false)
    return result.messageId
  } catch (error) {
    if (error instanceof DeliveryError) throw error
    const e = error as { code?: string; command?: string; responseCode?: number }
    // An explicit SMTP rejection or a failure before DATA cannot have accepted
    // the message. A disconnect during DATA/after acceptance is ambiguous.
    const safe = Boolean(e.responseCode && e.responseCode >= 400 && e.responseCode < 500) || ["CONN", "EHLO", "HELO", "AUTH", "MAIL FROM", "RCPT TO"].includes(e.command || "") || e.code === "EDNS"
    throw new DeliveryError(safe)
  } finally { smtp.close() }
}
