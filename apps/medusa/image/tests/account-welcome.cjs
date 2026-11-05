const { test } = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')
const path = require('node:path')
const base = process.env.MEDUSA_TEST_ROOT || path.resolve(__dirname, '../.medusa/server')
const app = Module.createRequire(path.join(base, 'package.json'))
let handler, enqueueFailure = false, enqueued, recorded
const load = Module._load
Module._load = function (request, ...rest) {
  if (request === '@medusajs/framework/workflows-sdk') return {
    createStep: (_name, callback) => { handler = callback; return () => {} },
    createWorkflow: () => ({}), StepResponse: class { constructor(value) { this.value = value } }, WorkflowResponse: class {},
  }
  if (request === '@medusajs/medusa/core-flows') return { createCustomerAccountWorkflow: {} }
  if (request === '../lib/customer-sync/store') return { identity: async () => ({ id: 'identity_test' }), record: async (...args) => { recorded = args } }
  if (request === '../lib/lifecycle/queue') return { enqueueAccountWelcome: async (...args) => { if (enqueueFailure) throw Error('outbox unavailable'); enqueued = args; return 'email:account_welcome:cus_test' } }
  return load.call(this, request, ...rest)
}
app('./src/workflows/complete-customer-account')
Module._load = load
const input = { customer_id: 'cus_test', email: 'test@example.com', payload: { locale: 'es', initial_consent: true, consent: false } }
test('new account welcome is queued after legal acceptance without marketing consent', async () => {
  enqueueFailure = false; let event
  const container = { resolve: () => ({ emit: async value => { event = value } }) }
  await handler(input, { container })
  assert.equal(recorded[2], 'legal'); assert.equal(recorded[3].consent, false)
  assert.deepEqual(enqueued.slice(1), ['cus_test', { email: 'test@example.com', locale: 'es' }])
  assert.deepEqual(event, { name: 'account.welcome_requested', data: { key: 'email:account_welcome:cus_test' } })
})
for (const failure of ['enqueue', 'event']) test(`${failure} outage preserves the new account and durable acceptance for repair`, async () => {
  enqueueFailure = failure === 'enqueue'; let warning
  const container = { resolve: name => name === 'logger' ? { warn: value => { warning = value } } : { emit: async () => { throw Error('event unavailable') } } }
  const result = await handler(input, { container })
  assert.equal(result.value, 'cus_test'); assert.equal(recorded[2], 'legal')
  assert.equal(warning, 'account.welcome_delivery_deferred')
})
