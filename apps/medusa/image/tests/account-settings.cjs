const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file)
const { GET, POST } = require('../src/api/store/account/settings/route.ts')
const { fixture } = require('./support/customer-fixture.cjs')
function setup() {
  process.env.CUSTOMER_TERMS_VERSION = process.env.CUSTOMER_PRIVACY_VERSION = 'v1'
  const f = fixture()
  f.customers[0].metadata = { secret: 'private', shopping_preferences: { locale: 'es', internal: 'private' } }
  let changed = 0, deleted = [], closed = false; const cache = new Map()
  const auth = {
    listAuthIdentities: async filter => { assert.equal(filter.app_metadata.customer_id, 'cus_1'); return [{ id: 'auth_1', provider_identities: [{ id: 'p1', provider: 'emailpass', entity_id: 'person@example.com' }, { id: 'p2', provider: 'google', user_metadata: { email: 'person@example.com', private: 'private' }, provider_metadata: { token: 'private' } }] }] },
    authenticate: async (_provider, input) => ({ success: input.body.password === 'correct', authIdentity: { app_metadata: { customer_id: input.body.password === 'wrong-owner' ? 'cus_other' : 'cus_1' } } }),
    updateProvider: async (_provider, input) => { assert.equal(input.entity_id, 'person@example.com'); changed++; return { success: true } },
    deleteProviderIdentities: async ids => { deleted = ids }, deleteAuthIdentities: async ids => { deleted = ids },
  }
  const resolve = f.container.resolve
  f.container.resolve = name => name === 'auth' ? auth : name === 'cache' ? { get: async k => cache.get(k), set: async (k, n) => { cache.set(k, n) }, invalidate: async k => cache.delete(k) } : name === 'customer' ? { retrieveCustomer: async id => { assert.equal(id, 'cus_1'); return f.customers[0] }, softDeleteCustomers: async ids => { assert.deepEqual(ids, ['cus_1']); closed = true } } : resolve(name)
  const req = { scope: f.container, auth_context: { actor_id: 'cus_1', auth_identity_id: 'auth_1' }, body: {}, headers: {}, url: '/store/account/settings' }
  let output
  const res = { json: data => { output = data; return data } }
  return { ...f, req, res, auth, cache, result: () => output, changed: () => changed, deleted: () => deleted, closed: () => closed }
}
test('settings exposes provider labels but no credential metadata', async () => { const f = setup(); await GET(f.req, f.res); assert.equal(f.result().providers.length, 2); assert.ok(!JSON.stringify(f.result()).includes('private')) })
test('export allowlists profile and preference fields and ignores browser customer ID', async () => { const f = setup(); f.req.body = { operation: 'export', customer_id: 'cus_other' }; await POST(f.req, f.res); assert.equal(f.result().profile.email, 'person@example.com'); assert.deepEqual(f.result().preferences, { locale: 'es' }); assert.ok(!JSON.stringify(f.result()).includes('private')); assert.ok(!JSON.stringify(f.result()).includes('cus_1')) })
test('password changes require current password and matching strong replacement', async () => { const f = setup(); f.req.body = { operation: 'password', current_password: 'incorrect', new_password: 'new-secure-password', confirm_password: 'new-secure-password' }; await assert.rejects(POST(f.req, f.res)); assert.equal(f.changed(), 0); f.req.body.current_password = 'correct'; await POST(f.req, f.res); assert.equal(f.changed(), 1) })
test('password proof must belong to authenticated customer', async () => { const f = setup(); f.auth.authenticate = async () => ({ success: true, authIdentity: { app_metadata: { customer_id: 'cus_other' } } }); f.req.body = { operation: 'password', current_password: 'correct', new_password: 'new-secure-password', confirm_password: 'new-secure-password' }; await assert.rejects(POST(f.req, f.res)); assert.equal(f.changed(), 0) })
test('Google-only identities cannot disconnect their last method', async () => { const f = setup(); f.auth.listAuthIdentities = async () => [{ provider_identities: [{ id: 'p2', provider: 'google' }] }]; f.req.body = { operation: 'disconnect-google' }; await assert.rejects(POST(f.req, f.res)); assert.deepEqual(f.deleted(), []) })
test('closing requires exact confirmation and password; queues opt-out before soft deletion', async () => { const f = setup(); f.req.body = { operation: 'close', confirm_email: 'someone@example.com', current_password: 'correct' }; await assert.rejects(POST(f.req, f.res)); assert.equal(f.closed(), false); f.req.body.confirm_email = 'person@example.com'; await POST(f.req, f.res); assert.equal(f.closed(), true); assert.equal(f.decisions[0].payload.consent, false); assert.equal(f.decisions[0].payload.source, 'account_closure'); assert.deepEqual(f.deleted(), ['auth_1']) })
test('sensitive operations are limited per customer', async () => { const f = setup(); f.req.body = { operation: 'export' }; for (let i=0;i<10;i++) await POST(f.req, f.res); await assert.rejects(POST(f.req, f.res), /fifteen minutes/) })
test('anonymous requests cannot select an account', async () => { const f = setup(); f.req.auth_context.actor_id = ''; f.req.body = { operation: 'export', customer_id: 'cus_1' }; await assert.rejects(POST(f.req, f.res), /Sign in/) })

test('Google closure requires an exact one-use OAuth proof, not a refreshed JWT', async () => {
  const f = setup(); f.auth.listAuthIdentities = async () => [{ id: 'google_auth', provider_identities: [{ id: 'p2', provider: 'google' }] }];
  f.req.headers.authorization = 'Bearer callback-token'; f.req.body = { operation: 'close', confirm_email: 'person@example.com' };
  await assert.rejects(POST(f.req, f.res), /Google again/); assert.equal(f.closed(), false);
  const key = 'account-google-proof:' + require('node:crypto').createHash('sha256').update('callback-token').digest('hex');
  f.cache.set(key, 'cus_other'); await assert.rejects(POST(f.req, f.res), /Google again/);
  f.cache.set(key, 'cus_1'); await POST(f.req, f.res); assert.equal(f.closed(), true); assert.equal(f.cache.has(key), false);
})
test('adding a password uses recent Google proof and keeps the existing customer', async () => {
  const f = setup(); f.auth.listAuthIdentities = async () => [{ id: 'google_auth', provider_identities: [{ id: 'p2', provider: 'google', user_metadata: { email: 'person@example.com' } }] }];
  let linked;
  f.auth.listProviderIdentities = async () => [];
  f.auth.register = async () => ({ success: true, authIdentity: { id: 'new_password_auth', app_metadata: {} } });
  f.auth.updateAuthIdentities = async data => { linked = data };
  f.req.headers.authorization = 'Bearer callback-token'; f.req.body = { operation: 'set-password', new_password: 'new-secure-password', confirm_password: 'new-secure-password' };
  await assert.rejects(POST(f.req, f.res), /Google again/); assert.equal(linked, undefined);
  const key = 'account-google-proof:' + require('node:crypto').createHash('sha256').update('callback-token').digest('hex');
  f.cache.set(key, 'cus_1'); f.auth.listProviderIdentities = async () => [{ id: 'collision' }]; await assert.rejects(POST(f.req, f.res), /identity conflict/); assert.equal(linked, undefined);
  f.auth.listProviderIdentities = async () => []; await POST(f.req, f.res);
  assert.deepEqual(linked, { id: 'new_password_auth', app_metadata: { customer_id: 'cus_1' } }); assert.equal(f.customers.length, 1); assert.equal(f.cache.has(key), false);
})
