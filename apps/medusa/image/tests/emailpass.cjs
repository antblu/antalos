const { test } = require("node:test")
const assert = require("node:assert/strict")
const { createRequire } = require("node:module")
const appRequire = createRequire(`${process.env.MEDUSA_TEST_ROOT || "/app"}/package.json`)
const { POST } = appRequire("./src/api/auth/emailpass/user/route")

test("emailpass identities cannot self-provision or claim an administrator", async () => {
  const request = {
    auth_context: { auth_identity_id: "unregistered", user_metadata: { email: "existing@example.com" } },
    scope: { resolve: () => { throw new Error("Must not resolve account services") } },
  }
  await assert.rejects(POST(request, {}), (error) =>
    error.type === "not_allowed" && /invitation or operator provisioning/.test(error.message))
})
