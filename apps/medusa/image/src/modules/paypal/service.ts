import { createHash } from "node:crypto"
import { AbstractPaymentProvider, BigNumber, PaymentSessionStatus } from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput, CancelPaymentInput, CapturePaymentInput, DeletePaymentInput,
  GetPaymentStatusInput, InitiatePaymentInput, RefundPaymentInput, RetrievePaymentInput,
  UpdatePaymentInput, ProviderWebhookPayload, WebhookActionResult, BigNumberInput,
} from "@medusajs/framework/types"

type Options = { clientId: string; clientSecret: string; webhookId: string; environment: "sandbox" | "live"; autoCapture?: boolean; storefrontUrl: string }
type Money = { currency_code: string; value: string }
type Transaction = { id: string; status: string; amount?: Money }
type Order = {
  id: string; status: string; intent: string;
  links?: { rel: string; href: string }[];
  purchase_units: { custom_id: string; amount: Money; payments?: { authorizations?: Transaction[]; captures?: Transaction[] } }[];
}
type Stored = Record<string, unknown>

/** PayPal Orders v2 with authorization followed by capture through Medusa. */
export default class PayPalProvider extends AbstractPaymentProvider<Options> {
  static identifier = "paypal"
  private options: Options
  private token?: { value: string; expires: number }
  constructor(container: Record<string, unknown>, options: Options) {
    super(container, options)
    this.options = options
  }
  static validateOptions(options: Options) {
    if (!options.clientId || !options.clientSecret || !options.webhookId || !options.storefrontUrl)
      throw new Error("PayPal requires client credentials, webhook ID and storefront URL")
    if (new URL(options.storefrontUrl).protocol !== "https:") throw new Error("PayPal requires an HTTPS storefront")
    if (!["sandbox", "live"].includes(options.environment)) throw new Error("PayPal environment must be sandbox or live")
  }
  private get origin() { return this.options.environment === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com" }
  private async accessToken() {
    if (this.token && this.token.expires > Date.now()) return this.token.value
    const response = await fetch(`${this.origin}/v1/oauth2/token`, {
      method: "POST", signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Basic ${Buffer.from(`${this.options.clientId}:${this.options.clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    })
    if (!response.ok) throw new Error("PayPal authentication failed")
    const result = await response.json() as { access_token: string; expires_in: number }
    this.token = { value: result.access_token, expires: Date.now() + Math.max(0, result.expires_in - 60) * 1000 }
    return this.token.value
  }
  private async request<T>(path: string, body?: unknown, key?: string): Promise<T> {
    const response = await fetch(`${this.origin}${path}`, {
      method: body === undefined ? "GET" : "POST", signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${await this.accessToken()}`, "Content-Type": "application/json", Prefer: "return=representation",
        ...(key ? { "PayPal-Request-Id": createHash("sha256").update(key).digest("hex").slice(0, 38) } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    // Do not log bodies: PayPal responses can contain buyer and credential data.
    if (!response.ok) throw new Error(`PayPal request failed (${response.status}); retry the same operation or reconcile its status`)
    return (response.status === 204 ? {} : await response.json()) as T
  }
  private id(data?: Stored) {
    if (typeof data?.id !== "string" || !/^[A-Z0-9]+$/i.test(data.id)) throw new Error("Missing PayPal order ID")
    return data.id
  }
  private money(amount: BigNumberInput, currency: string): Money {
    const code = currency.toUpperCase()
    // PayPal supported currencies; do not convert a Medusa total or silently round it.
    if (!/^(AUD|BRL|CAD|CNY|CZK|DKK|EUR|HKD|HUF|ILS|JPY|MYR|MXN|TWD|NZD|NOK|PHP|PLN|GBP|SGD|SEK|CHF|THB|USD)$/.test(code))
      throw new Error("This currency is not supported by PayPal; select another payment method")
    const digits = /^(HUF|JPY|TWD)$/.test(code) ? 0 : 2
    const number = new BigNumber(amount).bigNumber!
    if (!number.isFinite() || !number.isGreaterThan(0) || number.decimalPlaces()! > digits)
      throw new Error("Invalid PayPal payment amount")
    return { currency_code: code, value: number.toFixed(digits) }
  }
  private async order(data?: Stored) {
    const order = await this.request<Order>(`/v2/checkout/orders/${this.id(data)}`)
    const unit = order.purchase_units?.[0]
    if (order.intent !== "AUTHORIZE" || order.purchase_units.length !== 1 || !unit ||
        unit.custom_id !== data?.session_id || unit.amount.currency_code !== data?.currency_code ||
        unit.amount.value !== data?.amount)
      throw new Error("PayPal order does not match the Medusa payment session")
    return order
  }
  private status(order: Order): PaymentSessionStatus {
    const payments = order.purchase_units[0].payments
    const capture = payments?.captures?.[0]
    if (capture?.status === "COMPLETED") return PaymentSessionStatus.CAPTURED
    const auth = payments?.authorizations?.[0]
    if (auth?.status === "CREATED" || auth?.status === "PARTIALLY_CAPTURED") return PaymentSessionStatus.AUTHORIZED
    if (auth?.status === "VOIDED" || auth?.status === "EXPIRED") return PaymentSessionStatus.CANCELED
    if (capture?.status === "DECLINED" || capture?.status === "FAILED") return PaymentSessionStatus.ERROR
    return PaymentSessionStatus.PENDING
  }
  async initiatePayment(input: InitiatePaymentInput) {
    const session = input.data?.session_id
    if (typeof session !== "string" || !session) throw new Error("Missing Medusa payment session ID")
    const amount = this.money(input.amount, input.currency_code)
    const storefront = new URL(this.options.storefrontUrl)
    const returnUrl = new URL(String(input.data?.return_url || "/checkout?payment_return=1"), storefront)
    const cancelUrl = new URL(String(input.data?.cancel_url || "/checkout"), storefront)
    if (returnUrl.origin !== storefront.origin || cancelUrl.origin !== storefront.origin)
      throw new Error("Invalid PayPal return origin")
    const order = await this.request<Order>("/v2/checkout/orders", {
      intent: "AUTHORIZE", purchase_units: [{ custom_id: session, amount }],
      payment_source: { paypal: { experience_context: { user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING", return_url: returnUrl.href, cancel_url: cancelUrl.href } } },
    }, `create:${input.context?.idempotency_key || session}:${amount.currency_code}:${amount.value}`)
    const approval = order.links?.find(link => link.rel === "payer-action" || link.rel === "approve")?.href
    if (!approval) throw new Error("PayPal did not return an approval URL")
    return { id: order.id, status: PaymentSessionStatus.PENDING, data: {
      id: order.id, session_id: session, amount: amount.value, currency_code: amount.currency_code, approval_url: approval,
      return_url: returnUrl.href, cancel_url: cancelUrl.href,
    } }
  }
  async authorizePayment(input: AuthorizePaymentInput) {
    if (input.data?.canceled) throw new Error("This PayPal payment session was canceled")
    let order = await this.order(input.data)
    if (order.status === "APPROVED" && !order.purchase_units[0].payments?.authorizations?.length) {
      await this.request<Order>(`/v2/checkout/orders/${order.id}/authorize`, {}, `authorize:${order.id}`)
      order = await this.order(input.data)
    }
    if (this.options.autoCapture && this.status(order) === PaymentSessionStatus.AUTHORIZED) {
      const captured = await this.capturePayment(input)
      order = await this.order(captured.data)
      return { status: this.status(order), data: captured.data }
    }
    return { status: this.status(order), data: { ...input.data } }
  }
  async capturePayment(input: CapturePaymentInput) {
    const order = await this.order(input.data)
    if (this.status(order) === PaymentSessionStatus.CAPTURED) return { data: { ...input.data } }
    const auth = order.purchase_units[0].payments?.authorizations?.[0]
    if (!auth || this.status(order) !== PaymentSessionStatus.AUTHORIZED) throw new Error("PayPal payment is not authorized")
    const capture = await this.request<Transaction>(`/v2/payments/authorizations/${auth.id}/capture`, { final_capture: true }, `capture:${auth.id}`)
    if (capture.status !== "COMPLETED") throw new Error("PayPal capture is pending; reconcile before fulfillment")
    return { data: { ...input.data, capture_id: capture.id } }
  }
  async refundPayment(input: RefundPaymentInput) {
    const order = await this.order(input.data)
    const capture = order.purchase_units[0].payments?.captures?.[0]
    if (!capture || !input.context?.idempotency_key) throw new Error("PayPal refund requires a capture and idempotency key")
    const result = await this.request<Transaction>(`/v2/payments/captures/${capture.id}/refund`, {
      amount: this.money(input.amount, String(input.data?.currency_code)),
    }, `refund:${input.context.idempotency_key}`)
    if (result.status !== "COMPLETED") throw new Error("PayPal refund is pending; reconcile before retrying")
    return { data: { ...input.data, refund_id: result.id } }
  }
  async cancelPayment(input: CancelPaymentInput) {
    const order = await this.order(input.data)
    const payments = order.purchase_units[0].payments
    if (payments?.captures?.length) throw new Error("Captured PayPal payments must be refunded")
    const auth = payments?.authorizations?.[0]
    if (auth && auth.status !== "VOIDED" && auth.status !== "EXPIRED")
      await this.request(`/v2/payments/authorizations/${auth.id}/void`, {}, `void:${auth.id}`)
    return { data: { ...input.data, canceled: true } }
  }
  async deletePayment(input: DeletePaymentInput) { return this.cancelPayment(input) }
  async retrievePayment(input: RetrievePaymentInput) {
    const order = await this.order(input.data)
    return { data: { ...input.data, paypal_status: order.status } }
  }
  async getPaymentStatus(input: GetPaymentStatusInput) {
    const order = await this.order(input.data)
    return { status: input.data?.canceled ? PaymentSessionStatus.CANCELED : this.status(order) }
  }
  async updatePayment(input: UpdatePaymentInput) {
    const order = await this.order(input.data)
    // Never reuse an approved order for a new total. An unapproved order can
    // be replaced; its approval alone cannot authorize a Medusa payment.
    const money = this.money(input.amount, input.currency_code)
    if (money.value !== input.data?.amount || money.currency_code !== input.data?.currency_code) {
      if (!["CREATED", "PAYER_ACTION_REQUIRED"].includes(order.status) || order.purchase_units[0].payments?.authorizations?.length)
        throw new Error("Cancel this PayPal payment before changing its amount")
      return this.initiatePayment(input)
    }
    return { data: { ...input.data } }
  }
  async getWebhookActionAndData(payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    const header = (key: string) => {
      const value = payload.headers[key]
      if (typeof value !== "string" || !value) throw new Error("Missing PayPal webhook signature")
      return value
    }
    const event = JSON.parse(Buffer.isBuffer(payload.rawData) ? payload.rawData.toString("utf8") : payload.rawData) as Record<string, unknown>
    const verification = await this.request<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
      auth_algo: header("paypal-auth-algo"), cert_url: header("paypal-cert-url"),
      transmission_id: header("paypal-transmission-id"), transmission_sig: header("paypal-transmission-sig"),
      transmission_time: header("paypal-transmission-time"), webhook_id: this.options.webhookId, webhook_event: event,
    })
    if (verification.verification_status !== "SUCCESS") throw new Error("Invalid PayPal webhook signature")
    const actions: Record<string, WebhookActionResult["action"]> = {
      "PAYMENT.AUTHORIZATION.CREATED": "authorized",
      "PAYMENT.AUTHORIZATION.VOIDED": "canceled",
      "PAYMENT.CAPTURE.COMPLETED": "captured",
      "PAYMENT.CAPTURE.DENIED": "failed",
    }
    const action = actions[String(event.event_type)]
    if (!action)
      return { action: "not_supported" }
    const resource = event.resource as { id?: string; supplementary_data?: { related_ids?: { order_id?: string } }; links?: { rel: string; href: string }[] }
    let id = resource?.supplementary_data?.related_ids?.order_id
    if (!id) {
      const up = resource?.links?.find(link => link.rel === "up")?.href
      if (typeof up === "string") {
        try {
          const url = new URL(up)
          if (url.origin === this.origin && !url.username && !url.password)
            id = url.pathname.match(/^\/v2\/checkout\/orders\/([A-Z0-9]+)$/i)?.[1]
        } catch { /* Unsupported resource link; never follow an arbitrary URL. */ }
      }
    }
    if (!id || !/^[A-Z0-9]+$/i.test(id)) return { action: "not_supported" }
    const order = await this.request<Order>(`/v2/checkout/orders/${id}`)
    const unit = order.purchase_units?.[0]
    if (order.intent !== "AUTHORIZE" || order.purchase_units.length !== 1 || !unit?.custom_id?.startsWith("payses_"))
      return { action: "not_supported" }
    const transactions = String(event.event_type).startsWith("PAYMENT.CAPTURE.") ? unit.payments?.captures : unit.payments?.authorizations
    const transaction = transactions?.find(item => item.id === resource.id)
    const statuses: Record<string, string[]> = { authorized: ["CREATED"], canceled: ["VOIDED"], captured: ["COMPLETED"], failed: ["DECLINED", "DENIED", "FAILED"] }
    if (!transaction?.amount || !statuses[action]?.includes(transaction.status)) return { action: "not_supported" }
    return { action,
      data: { session_id: unit.custom_id, amount: new BigNumber(transaction.amount.value) } }
  }
}
