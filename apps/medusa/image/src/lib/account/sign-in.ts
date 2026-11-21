import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto"
import type { AuthIdentityDTO, IAuthModuleService, ICacheService, ICustomerModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { generateJwtTokenForAuthIdentity } from "@medusajs/medusa/api/auth/utils/generate-jwt-token"
import { locked } from "../customer-sync/store"
import { mailBudget } from "./security"
import { sendAccountMail } from "./mail"

const lifetime = 600
const maxAttempts = 5
const proofClaim = "emiliany_email_otp_verified"
const invalidSignIn = () => new MedusaError(MedusaError.Types.UNAUTHORIZED, "Invalid email or password")
const cache = (scope: MedusaContainer) => scope.resolve<ICacheService>(Modules.CACHE)

type Challenge = {
  identityId: string
  customerId: string
  email: string
  codeHash: string
  attempts: number
  expires: number
}

export function hasEmailSignInProof(metadata?: Record<string, unknown>) {
  return metadata?.[proofClaim] === true
}

function codeHash(scope: MedusaContainer, challenge: string, code: string) {
  const { http } = scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE).projectConfig
  const secret = http.jwtSecret
  if (typeof secret !== "string" && !Buffer.isBuffer(secret)) throw new Error("A shared signing secret is required for email verification")
  return createHmac("sha256", secret).update("customer-email-sign-in:" + challenge + ":" + code).digest()
}

export async function emailSignInToken(scope: MedusaContainer, identity: AuthIdentityDTO, verifiedAt: Date | string) {
  const { http } = scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE).projectConfig
  return generateJwtTokenForAuthIdentity({
    authIdentity: { ...identity, app_metadata: { ...identity.app_metadata, [proofClaim]: true } },
    actorType: "customer",
    authProvider: "emailpass",
    container: scope,
    mfaEnabled: true,
    mfaChallengeCompletedAt: verifiedAt,
  }, { secret: http.jwtSecret!, expiresIn: http.jwtExpiresIn, options: http.jwtOptions })
}

export async function beginEmailSignIn(scope: MedusaContainer, data: Record<string, unknown>) {
  if (typeof data.email !== "string" || !data.email.trim() || data.email.length > 254 ||
      typeof data.password !== "string" || !data.password || data.password.length > 1024) throw invalidSignIn()
  const auth = scope.resolve<IAuthModuleService>(Modules.AUTH)
  const result = await auth.authenticate("emailpass", {
    url: "", protocol: "https", headers: {}, query: {},
    body: { email: data.email.trim(), password: data.password },
  })
  const identity = result.authIdentity
  const customerId = identity?.app_metadata?.customer_id
  if (!result.success || !identity || typeof customerId !== "string" || !customerId) throw invalidSignIn()
  const customer = await scope.resolve<ICustomerModuleService>(Modules.CUSTOMER).retrieveCustomer(customerId)
  const email = customer.email?.trim().toLowerCase()
  if (!customer.has_account || !email || !/^[^\s@<>,;:"]+@[^\s@<>,;:"]+\.[^\s@<>,;:"]+$/.test(email) ||
      email !== data.email.trim().toLowerCase()) throw invalidSignIn()

  const challenge = randomBytes(32).toString("hex")
  const key = "account-sign-in:" + challenge
  const timeoutKey = "account-sign-in-send:" + customerId
  const code = String(randomInt(1_000_000)).padStart(6, "0")
  const reserved = await locked(scope, timeoutKey, async () => {
    if (await cache(scope).get(timeoutKey)) return false
    await mailBudget(scope, email)
    await cache(scope).set(timeoutKey, true, 30)
    await cache(scope).set(key, {
      identityId: identity.id,
      customerId, email, codeHash: codeHash(scope, challenge, code).toString("hex"),
      attempts: 0, expires: Date.now() + lifetime * 1000,
    } satisfies Challenge, lifetime)
    return true
  })
  if (!reserved) return { status: "wait" as const }

  const spanish = typeof data.locale === "string" && data.locale.startsWith("es")
  try {
    await sendAccountMail(email, spanish ? "EMILIANY — Tu código de inicio de sesión" : "EMILIANY — Your sign-in code",
      spanish ? "Tu código de inicio de sesión es " + code + ". Caduca en 10 minutos. Si no solicitaste este código, ignora este mensaje."
        : "Your sign-in code is " + code + ". It expires in 10 minutes. If you did not request this code, ignore this message.")
  } catch {
    await cache(scope).invalidate(key)
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Sign-in email could not be delivered")
  }
  return { status: "sent" as const, challenge }
}

export async function verifyEmailSignIn(scope: MedusaContainer, challenge: unknown, code: unknown) {
  if (typeof challenge !== "string" || !/^[a-f0-9]{64}$/.test(challenge)) return { status: "expired" as const }
  const key = "account-sign-in:" + challenge
  return locked(scope, key, async () => {
    const state = await cache(scope).get<Challenge>(key)
    if (!state || state.expires <= Date.now()) return { status: "expired" as const }
    const matches = typeof code === "string" && /^\d{6}$/.test(code) &&
      timingSafeEqual(codeHash(scope, challenge, code), Buffer.from(state.codeHash, "hex"))
    if (!matches) {
      const attempts = state.attempts + 1
      if (attempts >= maxAttempts) {
        await cache(scope).invalidate(key)
        return { status: "expired" as const }
      }
      await cache(scope).set(key, { ...state, attempts }, Math.max(1, Math.ceil((state.expires - Date.now()) / 1000)))
      return { status: "invalid" as const }
    }
    await cache(scope).invalidate(key)
    const auth = scope.resolve<IAuthModuleService>(Modules.AUTH)
    const identity = await auth.retrieveAuthIdentity(state.identityId, { relations: ["provider_identities"] })
    const customer = await scope.resolve<ICustomerModuleService>(Modules.CUSTOMER).retrieveCustomer(state.customerId)
    if (identity.app_metadata?.customer_id !== state.customerId || !customer.has_account ||
        customer.email?.trim().toLowerCase() !== state.email ||
        !identity.provider_identities?.some(provider => provider.provider === "emailpass" &&
          provider.entity_id.trim().toLowerCase() === state.email)) return { status: "expired" as const }

    return { status: "verified" as const, token: await emailSignInToken(scope, identity, new Date()) }
  })
}
