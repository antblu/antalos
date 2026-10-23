const { test } = require("node:test")
const assert = require("node:assert/strict")
const { createRequire } = require("node:module")
const appRequire = createRequire(`${process.env.MEDUSA_TEST_ROOT || "/app"}/package.json`)
const OdooService = appRequire("./src/modules/odoo/service").default
const options = { enabled: true, url: "https://odoo.invalid", dbName: "odoo", username: "catalog", apiKey: "secret-test-key" }

test("disabled Odoo integration does not authenticate or require credentials", async () => {
  const service = new OdooService({}, { enabled: false })
  await assert.rejects(service.listProducts(), /disabled/)
  assert.throws(() => new OdooService({}, { enabled: true }), /ODOO_API_KEY/)
})

test("Odoo faults cannot disclose a key through the error message", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, request) => {
    const { id } = JSON.parse(request.body)
    return new Response(JSON.stringify({ id, error: { data: { debug: options.apiKey } } }), { status: 200 })
  })
  await assert.rejects(new OdooService({}, options).listProducts(), (error) =>
    /Odoo RPC failed/.test(error.message) && !error.message.includes(options.apiKey))
})

test("catalog reads use stable ID pagination, variant prices and base Odoo fields", async (t) => {
  let logins = 0
  t.mock.method(globalThis, "fetch", async (url, request) => {
    assert.equal(url, "https://odoo.invalid/jsonrpc")
    const { id, params } = JSON.parse(request.body)
    let result
    if (params.service === "common") {
      logins++
      result = 42
    } else {
      const [, uid, key, model, method, args, kwargs] = params.args
      assert.equal(uid, 42)
      assert.equal(key, options.apiKey)
      if (method === "fields_get") result = { id: {}, name: {} }
      else if (model === "product.template") {
        assert.deepEqual(args, [[["id", ">", 5]]])
        assert.equal(kwargs.order, "id asc")
        assert.equal(kwargs.context.active_test, false)
        assert.ok(!kwargs.fields.includes("is_published"))
        result = [{ id: 9, name: "Ring", description_sale: false, active: true, sale_ok: true, currency_id: [1, "USD"], product_variant_ids: [17] }]
      } else if (model === "product.product") {
        result = [{ id: 17, name: "Ring", active: true, default_code: false, lst_price: 24.5, product_template_attribute_value_ids: [3] }]
      } else if (model === "product.template.attribute.value") {
        result = [{ id: 3, name: "Gold", attribute_id: [2, "Metal"] }]
      } else if (model === "res.currency") {
        result = [{ id: 1, name: "USD" }]
      } else throw new Error(`Unexpected model: ${model}`)
    }
    return new Response(JSON.stringify({ id, result }), { status: 200 })
  })
  const service = new OdooService({}, options)
  const [product] = await service.listProducts(5, 50)
  assert.equal(product.currency, "usd")
  assert.equal(product.is_published, undefined)
  assert.equal(product.variants[0].id, 17)
  assert.equal(product.variants[0].lst_price, 24.5)
  assert.deepEqual(product.variants[0].options, { Metal: "Gold" })
  await service.listProducts(5, 50)
  assert.equal(logins, 1)
})
