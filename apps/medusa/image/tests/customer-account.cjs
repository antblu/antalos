const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const Module = require('node:module')
const path = require('node:path')
const { fixture } = require('./support/customer-fixture.cjs')
const base = process.env.MEDUSA_TEST_ROOT || path.resolve(__dirname, '../.medusa/server')
const app = createRequire(path.join(base, 'package.json'))
const { identity, record, status } = app('./src/lib/customer-sync/store')
let creations = 0
const load = Module._load
Module._load = function(request, ...rest) {
  if (request.endsWith('/workflows/complete-customer-account')) return { completeCustomerAccount: c => ({ run: async ({ input }) => {
    creations++
    const customer = { id: 'new_customer', ...input.customerData }
    const link = await identity(c, customer.email, customer.id)
    await record(c, link.id, 'legal', { ...input.payload, customer_id: customer.id })
    return { result: customer }
  } }) }
  return load.call(this, request, ...rest)
}
const account = app('./src/api/store/account/route')
Module._load = load
const newsletter = app('./src/api/store/newsletter/route')
process.env.CUSTOMER_TERMS_VERSION = 'terms-v1'
process.env.CUSTOMER_PRIVACY_VERSION = 'privacy-v1'
function setup(provider = 'emailpass', registered = false) {
  const f = fixture()
  const original = f.container.resolve
  const auth = { retrieveAuthIdentity: async () => ({ id: 'auth_1', provider_identities: [{ provider, entity_id: provider === 'google' ? 'stable-google-subject' : 'new@example.com', user_metadata: { email: 'new@example.com', given_name: 'Jane' } }], app_metadata: {} }), updateAuthIdentities: async () => {}, authenticate: async () => ({ success: true, authIdentity: { app_metadata: { customer_id: 'cus_1' } } }) }
  f.container.resolve = name => name === 'auth' ? auth : name === 'cache' ? { get: async () => 0, set: async () => {}, invalidate: async () => {} } : original(name)
  const req = { scope: f.container, auth_context: { actor_id: registered ? 'cus_1' : undefined, auth_identity_id: 'auth_1' }, body: {}, url: '/store/account' }
  const res = { status() { return this }, json(value) { this.value = value; return value } }
  return { ...f, req, res, auth }
}
const acceptance = { terms_accepted: true, terms_version: 'terms-v1', privacy_policy_version: 'privacy-v1', locale: 'es' }
for (const provider of ['emailpass', 'google']) {
  test(`${provider} rejects missing affirmative legal acceptance before creation`, async () => { const f = setup(provider), before = creations; f.req.body = { ...acceptance, terms_accepted: false }; await assert.rejects(account.POST(f.req, f.res), /Accept/); assert.equal(creations, before); assert.equal(f.decisions.length, 0) })
  test(`${provider} signup permits unchecked marketing and records policy evidence`, async () => { const f = setup(provider); f.req.body = acceptance; await account.POST(f.req, f.res); assert.equal(f.decisions[0].payload.consent, false); assert.equal(f.decisions[0].payload.terms_version, 'terms-v1'); assert.ok(Date.parse(f.decisions[0].payload.at)); assert.equal(f.decisions[0].payload.auth_provider, provider === 'google' ? 'google' : 'credentials'); assert.equal(f.decisions[0].payload.locale, 'es') })
  test(`${provider} signup preserves explicit marketing opt-in`, async () => { const f = setup(provider); f.req.body = { ...acceptance, marketing_consent: true }; await account.POST(f.req, f.res); assert.equal(f.decisions[0].payload.consent, true) })
}
test('policy version mismatch rejects registration', async () => { const f = setup(); f.req.body = { ...acceptance, terms_version: 'old' }; await assert.rejects(account.POST(f.req, f.res), /Accept/) })
test('first Google authentication is pending until application acceptance', async () => { const f = setup('google'); await account.GET(f.req, f.res); assert.equal(f.res.value.pending, true); assert.equal(f.res.value.legal_required, true); assert.equal(f.decisions.length, 0) })
test('returning Google customer with current acceptance skips completion', async () => { const f = setup('google', true); const link = await identity(f.container, 'person@example.com', 'cus_1'); await record(f.container, link.id, 'legal', { terms_version: 'terms-v1', privacy_policy_version: 'privacy-v1' }); await account.GET(f.req, f.res); assert.equal(f.res.value.legal_required, false); assert.equal(f.res.value.pending, false) })
test('Google matching password account requires fresh proof and preserves consent/linkages', async () => { const f = setup('google'); f.customers[0].email = 'new@example.com'; f.customers[0].has_account = true; const link = await identity(f.container, 'new@example.com', 'cus_1', 10); link.mautic_id = 42; await record(f.container, link.id, 'marketing', { consent: false, source: 'account_settings' }); await record(f.container, link.id, 'legal', { terms_version: 'terms-v1', privacy_policy_version: 'privacy-v1' }); const before = creations; f.req.body = acceptance; await assert.rejects(account.POST(f.req, f.res), /password required/); let linked; f.auth.updateAuthIdentities = async data => { linked = data.app_metadata.customer_id }; f.req.body = { ...acceptance, password: 'existing-password', marketing_consent: true }; await account.POST(f.req, f.res); assert.equal(creations, before); assert.equal(linked, 'cus_1'); assert.equal(f.identities[0].mautic_id, 42); assert.equal(f.identities[0].odoo_id, 10); assert.equal((await status(f.container, 'cus_1')).marketing_consent, false); assert.equal(f.decisions.length, 2) })
test('invalid password cannot link Google identity', async () => { const f = setup('google'); f.customers[0].email = 'new@example.com'; f.auth.authenticate = async () => ({ success: false }); f.req.body = { ...acceptance, password: 'wrong' }; await assert.rejects(account.POST(f.req, f.res), /linking failed/) })
test('newsletter is explicit, normalizes email and deduplicates retry without creating a commerce account', async () => { const f = setup(); f.req.body = { email: ' NEWS@Example.com ', consent: true, locale: 'es' }; await newsletter.POST(f.req, f.res); await newsletter.POST(f.req, f.res); assert.equal(f.identities[0].email, 'news@example.com'); assert.equal(f.decisions.length, 1); assert.equal(f.decisions[0].payload.source, 'website_newsletter'); assert.equal(f.decisions[0].payload.consent, true); assert.equal(f.identities[0].customer_id, null) })
test('newsletter links an existing Medusa customer', async () => { const f = setup(); f.req.body = { email: 'person@example.com', consent: true }; await newsletter.POST(f.req, f.res); assert.equal(f.identities[0].customer_id, 'cus_1') })
test('newsletter rejects absent consent', async () => { const f = setup(); f.req.body = { email: 'person@example.com' }; await assert.rejects(newsletter.POST(f.req, f.res), /consent required/) })
