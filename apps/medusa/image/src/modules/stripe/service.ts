import StripeProvider from "@medusajs/payment-stripe/dist/services/stripe-provider"
import { getSmallestUnit, getAmountFromSmallestUnit } from "@medusajs/payment-stripe/dist/utils/get-smallest-unit"
import type { RefundPaymentInput } from "@medusajs/framework/types"
export default class ConfirmedStripeProvider extends StripeProvider {
  async refundPayment({ amount, data, context }: RefundPaymentInput) {
    if (typeof data?.id !== "string" || typeof data.currency !== "string" || !context?.idempotency_key) throw new Error("Stripe refund requires payment and stable idempotency key")
    const key = context.idempotency_key
    const previous = (data.confirmed_refunds || {}) as Record<string, { id: string; amount: number }>
    const value = getSmallestUnit(amount, data.currency)
    if (previous[key]) {
      if (getSmallestUnit(previous[key].amount, data.currency) !== value) throw new Error("Refund key amount mismatch")
      return { data }
    }
    // Keep Medusa's currency conversion and Stripe API version unchanged.
    const created = await this.stripe_.refunds.create({ amount: value, payment_intent: data.id }, { idempotencyKey: key })
    // An idempotent create response can contain the original pending status.
    const refund = await this.stripe_.refunds.retrieve(created.id)
    if (refund.status !== "succeeded") throw new Error("Stripe refund is not confirmed; reconcile using the same refund idempotency key")
    return { data: { ...data, confirmed_refunds: { ...previous, [key]: { id: refund.id, amount: getAmountFromSmallestUnit(refund.amount, data.currency) } } } }
  }
}
