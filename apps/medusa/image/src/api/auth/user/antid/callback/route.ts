import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { IAuthModuleService, IUserModuleService } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { generateJwtTokenWithChecks } from "@medusajs/medusa/api/auth/utils/generate-jwt-token"

function stringParams(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] =>
    typeof entry[1] === "string",
  ))
}

// Provision only after the provider has verified the issuer, token, nonce and
// email. Authentik application bindings control who can become an administrator.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = req.scope.resolve<IAuthModuleService>(Modules.AUTH)
  const users = req.scope.resolve<IUserModuleService>(Modules.USER)
  const result = await auth.validateCallback("antid", {
    url: req.url,
    headers: stringParams(req.headers),
    query: stringParams(req.query),
    body: stringParams(req.body),
    protocol: req.protocol,
  })
  let identity = result.authIdentity
  if (!result.success || !identity) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "antID authentication failed")
  }
  if (identity.app_metadata?.user_id) {
    // A deleted administrator must not receive a valid login token.
    await users.retrieveUser(identity.app_metadata.user_id as string)
  } else {
    const metadata = identity.provider_identities?.find((item) => item.provider === "antid")?.user_metadata
    if (typeof metadata?.email !== "string" || !metadata.email) {
      throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "antID email is missing")
    }
    const email = metadata.email
    let [user] = await users.listUsers({ email })
    if (!user) {
      try {
        user = await users.createUsers({
          email,
          first_name: typeof metadata.given_name === "string" ? metadata.given_name : null,
          last_name: typeof metadata.family_name === "string" ? metadata.family_name : null,
        })
      } catch (error) {
        // The unique email constraint handles concurrent first logins on pods.
        ;[user] = await users.listUsers({ email })
        if (!user) throw error
      }
    }
    identity = await auth.updateAuthIdentities({
      id: identity.id,
      app_metadata: { ...identity.app_metadata, user_id: user.id },
    })
  }
  return res.json(await generateJwtTokenWithChecks(req.scope, {
    authIdentity: identity,
    mfaChallenge: result.mfaChallenge,
    actorType: "user",
    authProvider: "antid",
  }))
}

export const POST = GET
