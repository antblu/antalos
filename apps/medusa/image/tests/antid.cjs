const { test } = require("node:test")
const assert = require("node:assert/strict")
const { createRequire } = require("node:module")
const appRequire = createRequire(`${process.env.MEDUSA_TEST_ROOT || "/app"}/package.json`)
const Provider = appRequire("./src/modules/antid/service").default
const { GET: callback } = appRequire("./src/api/auth/user/antid/callback/route")
const { generateKeyPair, exportJWK, SignJWT } = appRequire("jose")

const options = {
  issuer: "https://idp.example/",
  client_id: "medusa-test",
  client_secret: "test-only-secret",
  callback_url: "https://medusa.example/app/login?auth_provider=antid",
}

test("antID verifies OIDC tokens, consumes state and keeps subject identity", async (t) => {
  const { privateKey, publicKey } = await generateKeyPair("RS256")
  const jwk = { ...await exportJWK(publicKey), kid: "test-key", alg: "RS256", use: "sig" }
  const originalFetch = global.fetch
  t.after(() => { global.fetch = originalFetch })
  let claims
  let signingKey = privateKey
  let tokenCalls = 0
  global.fetch = async (url, init) => {
    if (String(url).endsWith("/.well-known/openid-configuration")) {
      return Response.json({
        issuer: options.issuer,
        authorization_endpoint: `${options.issuer}authorize`,
        token_endpoint: `${options.issuer}token`,
        jwks_uri: `${options.issuer}jwks`,
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        token_endpoint_auth_methods_supported: ["client_secret_post"],
      })
    }
    if (String(url).endsWith("/jwks")) return Response.json({ keys: [jwk] })
    assert.equal(String(url), `${options.issuer}token`)
    const body = new URLSearchParams(init.body)
    assert.equal(body.get("client_secret"), options.client_secret)
    assert.equal(body.get("redirect_uri"), options.callback_url)
    assert.ok(body.get("code_verifier"))
    tokenCalls++
    const id_token = await new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "test-key" }).sign(signingKey)
    return Response.json({ access_token: "test-access", token_type: "Bearer", id_token })
  }
  const states = new Map()
  const identities = new Map()
  const service = {
    setState: async (key, value, ttl) => { assert.equal(ttl, 600); states.set(key, value) },
    getState: async (key) => { const value = states.get(key); states.delete(key); return value },
    retrieve: async ({ entity_id }) => {
      if (!identities.has(entity_id)) throw { type: "not_found" }
      return identities.get(entity_id)
    },
    create: async (data) => {
      const identity = { id: "auth-test", ...data }
      identities.set(data.entity_id, identity)
      return identity
    },
    update: async (subject, data) => Object.assign(identities.get(subject), data),
  }
  const provider = new Provider({}, options)
  async function start() {
    const result = await provider.authenticate({ body: {} }, service)
    assert.equal(result.success, true)
    const redirect = new URL(result.location)
    assert.equal(redirect.searchParams.get("redirect_uri"), options.callback_url)
    assert.equal(redirect.searchParams.get("code_challenge_method"), "S256")
    assert.ok(redirect.searchParams.get("code_challenge"))
    const now = Math.floor(Date.now() / 1000)
    claims = {
      iss: options.issuer, aud: options.client_id, sub: "stable-subject",
      iat: now, exp: now + 300, nonce: redirect.searchParams.get("nonce"),
      email: "Admin@Example.com", email_verified: true,
    }
    return { query: { state: redirect.searchParams.get("state"), code: "test-code" } }
  }
  await t.test("valid callback and repeat login retain identity", async () => {
    const input = await start()
    const result = await provider.validateCallback(input, service)
    assert.equal(result.success, true)
    assert.equal(result.authIdentity.user_metadata.email, "admin@example.com")
    assert.equal((await provider.validateCallback(input, service)).success, false)
    const repeated = await provider.validateCallback(await start(), service)
    assert.equal(repeated.authIdentity.id, result.authIdentity.id)
    assert.equal(identities.size, 1)
  })
  for (const [name, overrides] of [
    ["wrong nonce", { nonce: "wrong" }],
    ["wrong issuer", { iss: "https://attacker.example/" }],
    ["wrong audience", { aud: "other-client" }],
    ["expired token", { exp: 1 }],
    ["unverified email", { email_verified: false }],
    ["missing email", { email: undefined }],
    ["missing subject", { sub: undefined }],
  ]) {
    await t.test(name, async () => {
      const input = await start()
      Object.assign(claims, overrides)
      assert.equal((await provider.validateCallback(input, service)).success, false)
    })
  }
  await t.test("invalid signature", async () => {
    const input = await start()
    signingKey = (await generateKeyPair("RS256")).privateKey
    assert.equal((await provider.validateCallback(input, service)).success, false)
  })
  await t.test("unknown state makes no token request", async () => {
    const before = tokenCalls
    assert.equal((await provider.validateCallback({ query: { state: "unknown", code: "test" } }, service)).success, false)
    assert.equal(tokenCalls, before)
  })
  await t.test("rejects external callbacks and local registration", async () => {
    assert.equal((await provider.authenticate({ body: { callback_url: "https://attacker.example/" } }, service)).success, false)
    assert.equal((await provider.register()).success, false)
  })
})

test("provider construction needs no license, discovery or build secret", async () => {
  Provider.validateOptions(options)
  const provider = new Provider({}, { ...options, client_secret: undefined })
  assert.equal(provider.displayName, "antID")
  assert.equal((await provider.authenticate({}, {})).success, false)
  assert.throws(() => Provider.validateOptions({ ...options, issuer: "http://idp.example/" }))
})

test("administrator callback provisions, links and preserves actor association", async (t) => {
  const jwt = appRequire("jsonwebtoken")
  async function run({ existing, associated, denied, deleted } = {}) {
    let created = 0
    let linked = 0
    const user = { id: "user-test", email: "admin@example.com" }
    const identity = {
      id: "auth-test",
      app_metadata: associated ? { user_id: user.id } : {},
      provider_identities: [{ provider: "antid", user_metadata: { email: user.email } }],
    }
    const auth = {
      validateCallback: async () => ({ success: !denied, authIdentity: identity }),
      updateAuthIdentities: async (data) => { linked++; return { ...identity, ...data } },
      listAuthMfa: async () => [],
    }
    const users = {
      listUsers: async () => existing ? [user] : [],
      createUsers: async () => { created++; return user },
      retrieveUser: async () => { if (deleted) throw new Error("deleted user"); return user },
    }
    const config = { projectConfig: { http: { jwtSecret: "test-only-jwt-secret", jwtExpiresIn: "1h" } } }
    const scope = { resolve: (key) => {
      if (key === "auth") return auth
      if (key === "user") return users
      if (key === "configModule") return config
      throw new Error(`Unexpected dependency: ${key}`)
    } }
    let response
    await callback({ scope, query: {}, body: {}, headers: {}, url: "/callback", protocol: "https" }, {
      json: (data) => { response = data },
    })
    const token = jwt.verify(response.token, config.projectConfig.http.jwtSecret)
    assert.equal(token.actor_id, user.id)
    assert.equal(token.actor_type, "user")
    return { created, linked }
  }
  await t.test("first login creates administrator", async () => assert.deepEqual(await run(), { created: 1, linked: 1 }))
  await t.test("verified email links existing administrator", async () => assert.deepEqual(await run({ existing: true }), { created: 0, linked: 1 }))
  await t.test("existing subject retains user ID", async () => assert.deepEqual(await run({ associated: true }), { created: 0, linked: 0 }))
  await t.test("denied login cannot provision", async () => assert.rejects(run({ denied: true })))
  await t.test("deleted administrator cannot sign in", async () => assert.rejects(run({ associated: true, deleted: true })))
})
