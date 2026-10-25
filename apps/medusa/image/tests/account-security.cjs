const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const ts = require('typescript')
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file)
let messages = [], failMail = false, workflowInput
const load = Module._load
Module._load = function(request, ...rest) {
  if (request === './mail' && rest[0]?.filename.endsWith('/account/security.ts')) return { mailConfigured: () => true, sendAccountMail: async (to, subject, text) => { if (failMail) throw new Error('private SMTP credential response'); messages.push({ to, subject, text }) }, storefrontLink: () => 'https://store.example/en/account/reset-password' }
  if (request.endsWith('/workflows/change-customer-email')) return { changeCustomerEmail: () => ({ run: async ({ input }) => { workflowInput = input } }) }
  return load.call(this, request, ...rest)
}
const security = require('../src/lib/account/security.ts')
Module._load = load
const { fixture } = require('./support/customer-fixture.cjs')
function setup() {
  messages = []; failMail = false; workflowInput = undefined
  const f = fixture(), entries = new Map(), events = []
  f.customers[0].has_account = true
  let changed = 0
  const auth = { listProviderIdentities: async () => [{ id: 'p1', provider: 'emailpass', entity_id: 'person@example.com', auth_identity: { app_metadata: { customer_id: 'cus_1' } } }], listAuthIdentities: async () => [{ provider_identities: [{ id: 'p1', provider: 'emailpass', entity_id: 'person@example.com' }] }], updateProvider: async () => { changed++; return { success: true } } }
  const resolve = f.container.resolve
  f.container.resolve = name => name === 'cache' ? { get: async key => entries.get(key), set: async (key, value) => { entries.set(key, value) }, invalidate: async key => entries.delete(key) } : name === 'auth' ? auth : name === 'event_bus' ? { emit: async event => events.push(event) } : resolve(name)
  return { ...f, entries, auth, events, changed: () => changed }
}
test('public reset requests enqueue the same response without looking up account existence', async () => {
  const f = setup(); assert.deepEqual(await security.requestPasswordReset(f.container, 'person@example.com', 'en'), { accepted: true }); assert.deepEqual(await security.requestPasswordReset(f.container, 'unknown@example.com', 'en'), { accepted: true }); assert.equal(messages.length, 0); assert.equal(f.events.length, 2); assert.equal(f.events[0].name, f.events[1].name)
})
test('reset tokens are hashed, single-use and superseded by a new request', async () => {
  const f = setup(); await security.deliverPasswordReset(f.container, 'person@example.com', 'en'); const first = messages[0].text.match(/#token=([a-f0-9]{64})/)[1];
  assert.ok(!JSON.stringify([...f.entries]).includes(first));
  await security.deliverPasswordReset(f.container, 'person@example.com', 'en'); const second = messages[1].text.match(/#token=([a-f0-9]{64})/)[1];
  await assert.rejects(security.completePasswordReset(f.container, first, 'strong-new-password', 'strong-new-password')); assert.equal(f.changed(), 0);
  await security.completePasswordReset(f.container, second, 'strong-new-password', 'strong-new-password'); assert.equal(f.changed(), 1);
  await assert.rejects(security.completePasswordReset(f.container, second, 'strong-new-password', 'strong-new-password')); assert.equal(f.changed(), 1)
})
test('reset refuses a provider owned by another customer and unknown addresses receive no mail', async () => {
  const f = setup(); await security.deliverPasswordReset(f.container, 'unknown@example.com', 'en'); assert.equal(messages.length, 0);
  f.auth.listProviderIdentities = async () => [{ auth_identity: { app_metadata: { customer_id: 'other' } } }]; await security.deliverPasswordReset(f.container, 'person@example.com', 'en'); assert.equal(messages.length, 0)
})
test('email verification is customer-bound, expires, and limits guesses', async () => {
  const f = setup(); await security.requestEmailChange(f.container, 'cus_1', 'person@example.com', 'new@example.com', 'en'); const code = messages[0].text.match(/\b\d{8}\b/)[0];
  assert.ok(!JSON.stringify([...f.entries]).includes(code)); await assert.rejects(security.confirmEmailChange(f.container, 'cus_other', code));
  for(let i=0;i<5;i++) await assert.rejects(security.confirmEmailChange(f.container, 'cus_1', '00000000'));
  await assert.rejects(security.confirmEmailChange(f.container, 'cus_1', code), /new verification/); assert.equal(workflowInput, undefined);
  await security.requestEmailChange(f.container, 'cus_1', 'person@example.com', 'new@example.com', 'en'); f.entries.get('account-email:cus_1').expires = Date.now()-1; await assert.rejects(security.confirmEmailChange(f.container, 'cus_1', code), /new verification/)
})
test('verified email changes reject collisions and only invoke the compensated workflow after proof', async () => {
  const f = setup(); await security.requestEmailChange(f.container, 'cus_1', 'person@example.com', 'new@example.com', 'en'); const code = messages[0].text.match(/\b\d{8}\b/)[0];
  await assert.rejects(security.confirmEmailChange(f.container, 'cus_1', code), /cannot be used/); assert.equal(workflowInput, undefined);
  f.auth.listProviderIdentities = async () => []; await security.confirmEmailChange(f.container, 'cus_1', code); assert.equal(workflowInput.customerId, 'cus_1'); assert.equal(workflowInput.newEmail, 'new@example.com'); assert.equal(f.entries.has('account-email:cus_1'), false)
})
test('SMTP failures invalidate challenges and do not disclose upstream credentials', async () => {
  const f = setup(); failMail = true; await assert.rejects(security.requestEmailChange(f.container, 'cus_1', 'person@example.com', 'new@example.com', 'en'), e => !e.message.includes('private')); assert.equal(f.entries.has('account-email:cus_1'), false);
  await assert.rejects(security.deliverPasswordReset(f.container, 'person@example.com', 'en'), e => !e.message.includes('private'))
})
