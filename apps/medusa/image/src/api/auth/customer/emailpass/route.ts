import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { beginEmailSignIn, verifyEmailSignIn } from "../../../../lib/account/sign-in"

export async function POST(req: MedusaRequest<Record<string, unknown>>, res: MedusaResponse) {
  const data = req.body || {}
  res.setHeader("Cache-Control", "no-store")
  return res.json(data.operation === "verify"
    ? await verifyEmailSignIn(req.scope, data.challenge, data.code)
    : await beginEmailSignIn(req.scope, data))
}

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  return res.status(405).setHeader("Allow", "POST").json({ message: "Use POST to sign in" })
}
