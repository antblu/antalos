export function policyVersions() {
  const terms = process.env.CUSTOMER_TERMS_VERSION
  const privacy = process.env.CUSTOMER_PRIVACY_VERSION
  if (!terms || !privacy) throw new Error("Customer policy versions are not configured")
  return { terms, privacy }
}
export function legalCurrent(history: { payload: Record<string, unknown> }[]) {
  const versions = policyVersions()
  return history.some(({ payload }) => payload.terms_version === versions.terms && payload.privacy_policy_version === versions.privacy)
}
export function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid email")
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email")
  return email
}
export function backoff(attempt: number) { return Math.min(86400, 30 * 2 ** Math.min(attempt, 12)) * 1000 }
export function marketingState(decision: Record<string, unknown> | undefined, dnc: { reason: number }[], explicit: boolean) {
  // Bounce/manual suppression cannot be removed by a website opt-in.
  const blocked = dnc.some(d => Number(d.reason) !== 1) || (dnc.length > 0 && !explicit)
  return { subscribed: decision?.consent === true && !blocked, removeUnsubscribe: explicit && decision?.consent === true && !blocked }
}
