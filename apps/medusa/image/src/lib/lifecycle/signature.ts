import { createHmac, timingSafeEqual } from "node:crypto"
export function verifyFulfillmentSignature(raw: Buffer, timestamp: unknown, signature: unknown, secret: string | undefined, now = Date.now()) {
  if (!secret || secret.length < 32 || typeof timestamp !== "string" || !/^\d{10}$/.test(timestamp) || Math.abs(now - Number(timestamp) * 1000) > 300000 || typeof signature !== "string" || !/^[a-f0-9]{64}$/.test(signature)) return false
  const expected = createHmac("sha256", secret).update(timestamp).update(".").update(raw).digest()
  return timingSafeEqual(expected, Buffer.from(signature, "hex"))
}
