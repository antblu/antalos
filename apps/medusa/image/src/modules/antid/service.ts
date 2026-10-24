import { AbstractAuthModuleProvider, MedusaError } from "@medusajs/framework/utils"
import type {
  AuthenticationInput,
  AuthenticationResponse,
  AuthIdentityProviderService,
} from "@medusajs/framework/types"
import type { Configuration } from "openid-client" with { "resolution-mode": "import" }

type Options = {
  issuer: string
  client_id: string
  client_secret: string
  callback_url: string
  display_name?: string
  require_verified_email?: boolean
}

export default class AntidProvider extends AbstractAuthModuleProvider {
  static identifier = "antid"
  static DISPLAY_NAME = "antID"
  private options: Options
  private configuration?: Promise<Configuration>

  constructor(container: Record<string, unknown>, options: Options) {
    super()
    this.options = options
  }

  get displayName() {
    return this.options.display_name || AntidProvider.DISPLAY_NAME
  }

  static validateOptions(options: Options) {
    for (const key of ["issuer", "client_id", "callback_url"] as const) {
      if (!options[key]) throw new Error(`antID ${key} is required`)
    }
    for (const value of [options.issuer, options.callback_url]) {
      if (new URL(value).protocol !== "https:") {
        throw new Error("antID requires HTTPS issuer and callback URLs")
      }
    }
    // The secret is checked when authenticating, so image builds need no secret.
  }

  private async client() {
    if (!this.options.client_secret) throw new Error("antID client secret is required")
    if (!this.configuration) {
      const oidc = await import("openid-client")
      this.configuration = oidc.discovery(
        new URL(this.options.issuer),
        this.options.client_id,
        this.options.client_secret,
        oidc.ClientSecretPost(this.options.client_secret),
        { execute: [oidc.enableNonRepudiationChecks] },
      ).then((config) => {
        // openid-client derives redirect_uri by dropping the response URL's
        // query. Admin's registered callback includes auth_provider=antid, so
        // restore that exact configured URI only on authorization-code exchange.
        config[oidc.customFetch] = (url, init) => {
          if (url === config.serverMetadata().token_endpoint &&
              (typeof init.body === "string" || init.body instanceof URLSearchParams)) {
            const body = new URLSearchParams(init.body)
            if (body.get("grant_type") === "authorization_code") {
              body.set("redirect_uri", this.options.callback_url)
              return fetch(url, { ...init, body })
            }
          }
          return fetch(url, init as RequestInit)
        }
        return config
      }).catch((error) => {
        this.configuration = undefined
        throw error
      })
    }
    return this.configuration
  }

  async register(): Promise<AuthenticationResponse> {
    return { success: false, error: "Use antID to sign in" }
  }

  async authenticate(
    input: AuthenticationInput,
    identities: AuthIdentityProviderService,
  ): Promise<AuthenticationResponse> {
    const requested = input.body?.callback_url
    if (requested && requested !== this.options.callback_url) {
      return { success: false, error: "Invalid antID callback URL" }
    }
    try {
      const oidc = await import("openid-client")
      const config = await this.client()
      const state = oidc.randomState()
      const nonce = oidc.randomNonce()
      const verifier = oidc.randomPKCECodeVerifier()
      await identities.setState(state, { nonce, verifier }, 600)
      const location = oidc.buildAuthorizationUrl(config, {
        redirect_uri: this.options.callback_url,
        scope: "openid email profile",
        response_type: "code",
        state,
        nonce,
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
        code_challenge_method: "S256",
      })
      return { success: true, location: location.href }
    } catch {
      return { success: false, error: "Unable to start antID authentication" }
    }
  }

  async validateCallback(
    input: AuthenticationInput,
    identities: AuthIdentityProviderService,
  ): Promise<AuthenticationResponse> {
    const params = { ...input.body, ...input.query }
    if (typeof params.state !== "string" || typeof params.code !== "string" || params.error) {
      return { success: false, error: "Invalid antID callback" }
    }
    try {
      // Medusa consumes the shared Redis state on read, preventing reuse.
      const state = await identities.getState(params.state)
      if (typeof state?.nonce !== "string" || typeof state?.verifier !== "string") {
        return { success: false, error: "antID login expired or already used" }
      }
      const oidc = await import("openid-client")
      const callback = new URL(this.options.callback_url)
      for (const [key, value] of Object.entries(params)) {
        if (typeof value === "string") callback.searchParams.set(key, value)
      }
      const tokens = await oidc.authorizationCodeGrant(await this.client(), callback, {
        pkceCodeVerifier: state.verifier,
        expectedState: params.state,
        expectedNonce: state.nonce,
        idTokenExpected: true,
      })
      const claims = tokens.claims()
      if (!claims?.sub || typeof claims.email !== "string" || !claims.email.trim()) {
        return { success: false, error: "antID requires an email address and subject" }
      }
      if (this.options.require_verified_email !== false && claims.email_verified !== true) {
        return { success: false, error: "antID requires a verified email and subject" }
      }
      // This provider serves the Medusa user (administrator) actor. Customer
      // authentication uses its own provider; ordinary application membership
      // must never create or authenticate a Medusa administrator.
      if (!Array.isArray(claims.groups) || !claims.groups.includes("medusa-admins")) {
        return { success: false, error: "antID requires medusa-admins membership" }
      }
      const metadata = {
        email: claims.email.trim().toLowerCase(),
        name: claims.name,
        given_name: claims.given_name,
        family_name: claims.family_name,
      }
      let authIdentity
      try {
        authIdentity = await identities.retrieve({ entity_id: claims.sub })
        authIdentity = await identities.update(claims.sub, { user_metadata: metadata })
      } catch (error) {
        if (error.type !== MedusaError.Types.NOT_FOUND) throw error
        authIdentity = await identities.create({ entity_id: claims.sub, user_metadata: metadata })
      }
      return { success: true, authIdentity }
    } catch {
      return { success: false, error: "antID authentication failed" }
    }
  }
}
