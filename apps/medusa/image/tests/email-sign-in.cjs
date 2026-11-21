const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const { test } = require('node:test')
const { once } = require('node:events')
const express = require('express')
const ts = require('typescript')
const { ApiLoader } = require('@medusajs/framework/http')
const { configManager } = require('@medusajs/framework/config')
const { generateJwtToken } = require('@medusajs/framework/utils')

require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, file)

test('customer password authentication issues a usable token only after the email code', async t => {
  const mail = []
  let failMail = false
  const load = Module._load
  Module._load = function (request, parent, ...args) {
    if (request === './mail' && parent?.filename.includes('/lib/account/')) return {
      mailConfigured: () => true,
      sendAccountMail: async (to, subject, text) => {
        if (failMail) throw new Error('Test SMTP failure')
        mail.push({ to, subject, text })
      },
    }
    return load.call(this, request, parent, ...args)
  }
  t.after(() => { Module._load = load })

  const jwtSecret = 'local-test-signing-secret'
  const customer = { id: 'cus_test', email: 'shopper@example.test', has_account: true }
  const identity = {
    id: 'auth_test',
    app_metadata: { customer_id: customer.id },
    provider_identities: [{ provider: 'emailpass', entity_id: customer.email }],
  }
  const values = new Map()
  const locks = new Map()
  const logger = { debug() {}, info() {}, warn() {}, error() {} }
  configManager.loadConfig({
    baseDir: process.cwd(),
    throwOnValidationError: false,
    projectConfig: { projectConfig: { http: { jwtSecret, cookieSecret: jwtSecret, authMethodsPerActor: { customer: ['emailpass', 'google'] } } } },
  })
  const scope = { resolve(name) {
    if (name === 'configModule') return configManager.config
    if (name === 'logger') return logger
    if (name === 'customer') return { retrieveCustomer: async () => customer }
    if (name === 'auth') return {
      authenticate: async (_provider, { body }) => body.password === 'sign-in-test-password'
        ? { success: true, authIdentity: identity }
        : { success: false },
      retrieveAuthIdentity: async () => identity,
      validateAuthIdentity: async () => { throw Error('Registration token must not reach native refresh') },
    }
    if (name === 'cache') return {
      get: async key => values.get(key),
      set: async (key, value) => values.set(key, structuredClone(value)),
      invalidate: async key => values.delete(key),
    }
    if (name === 'locking') return {
      execute: async (key, fn) => {
        const pending = (locks.get(key) || Promise.resolve()).catch(() => {}).then(fn)
        locks.set(key, pending)
        try { return await pending } finally { if (locks.get(key) === pending) locks.delete(key) }
      },
    }
    if (name === 'query') return { graph: async () => ({ data: [{ token: 'pk_test', sales_channels_link: [] }] }) }
    throw new Error('Unexpected service: ' + name)
  } }
  const app = express()
  app.use((req, _res, next) => { req.scope = scope; next() })
  const coreDir = path.resolve(path.dirname(require.resolve('@medusajs/medusa/api/auth/utils/generate-jwt-token')), '../..')
  await new ApiLoader({ app, sourceDir: [coreDir, path.resolve('src/api')], container: scope }).load()
  app.get('/store/test-account-access', (_req, res) => res.sendStatus(200))
  const server = app.listen(0, '127.0.0.1')
  t.after(() => new Promise(resolve => server.close(resolve)))
  await once(server, 'listening')

  const request = (url, body, token) => fetch('http://127.0.0.1:' + server.address().port + url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'content-type': 'application/json',
      'x-publishable-api-key': 'pk_test',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const route = '/auth/customer/emailpass'
  const start = () => request(route, { email: customer.email, password: 'sign-in-test-password', locale: 'es-CO' })
  const verify = (challenge, code) => request(route, { operation: 'verify', challenge, code }).then(response => response.json())
  const codeFromMail = () => mail.at(-1).text.match(/\b\d{6}\b/)[0]
  const legacyToken = (provider, actorId = customer.id) => generateJwtToken({
    actor_id: actorId, actor_type: 'customer', auth_identity_id: identity.id, auth_provider: provider,
    app_metadata: { customer_id: customer.id }, user_metadata: {},
  }, { secret: jwtSecret, expiresIn: '1d' })
  const protectedRoute = '/store/test-account-access'
  const refreshRoute = '/auth/token/refresh'

  assert.equal((await request(route, { email: customer.email, password: 'wrong' })).status, 401)
  assert.equal(mail.length, 0)
  const alias = await request('/auth/%63ustomer/%65mailpass', { email: customer.email, password: 'sign-in-test-password' })
  assert.equal(alias.status, 404)
  assert.equal((await alias.json()).token, undefined)
  assert.equal((await request(route)).status, 405)
  assert.equal((await request(protectedRoute, undefined, legacyToken('emailpass'))).status, 401)
  assert.equal((await request(protectedRoute, undefined, legacyToken('google'))).status, 200)
  assert.equal((await request('/auth/session', {}, legacyToken('emailpass'))).status, 401)
  assert.equal((await request(refreshRoute, {}, legacyToken('emailpass'))).status, 401)
  assert.equal((await request(refreshRoute, {}, legacyToken('emailpass', ''))).status, 401)
  assert.deepEqual(await verify('a'.repeat(64), '123456'), { status: 'expired' })

  const pending = await start().then(response => response.json())
  assert.deepEqual(Object.keys(pending).sort(), ['challenge', 'status'])
  assert.equal(pending.status, 'sent')
  assert.equal(mail[0].to, customer.email)
  assert.match(mail[0].subject, /inicio de sesión/)
  assert.deepEqual(await start().then(response => response.json()), { status: 'wait' })
  const code = codeFromMail()
  assert.deepEqual(await verify(pending.challenge, code === '000000' ? '111111' : '000000'), { status: 'invalid' })
  const attempts = await Promise.all([verify(pending.challenge, code), verify(pending.challenge, code)])
  assert.deepEqual(attempts.map(result => result.status).sort(), ['expired', 'verified'])
  const token = attempts.find(result => result.status === 'verified').token
  assert.equal((await request(protectedRoute, undefined, token)).status, 200)
  const refreshed = await request(refreshRoute, {}, token).then(response => response.json())
  assert.equal((await request(protectedRoute, undefined, refreshed.token)).status, 200)

  values.delete('account-sign-in-send:' + customer.id)
  const limited = await start().then(response => response.json())
  const wrongCode = codeFromMail() === '000000' ? '111111' : '000000'
  for (let attempt = 1; attempt <= 5; attempt++) {
    assert.deepEqual(await verify(limited.challenge, wrongCode), { status: attempt === 5 ? 'expired' : 'invalid' })
  }
  assert.deepEqual(await verify(limited.challenge, codeFromMail()), { status: 'expired' })

  values.delete('account-sign-in-send:' + customer.id)
  const expired = await start().then(response => response.json())
  values.get('account-sign-in:' + expired.challenge).expires = Date.now() - 1
  assert.deepEqual(await verify(expired.challenge, codeFromMail()), { status: 'expired' })

  values.delete('account-sign-in-send:' + customer.id)
  failMail = true
  const failed = await start()
  assert.equal(failed.ok, false)
  const error = await failed.json()
  assert.equal(error.token, undefined)
  assert.equal(error.challenge, undefined)
})
