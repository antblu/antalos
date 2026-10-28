const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const ts = require('typescript')
const express = require('express')
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file)
const load = Module._load
Module._load = function(request, ...rest) {
  if (request === '@medusajs/framework/http') return {
    defineMiddlewares: config => config,
    authenticate: (_actor, _methods, options = {}) => (req, res, next) => {
      if (options.allowUnauthenticated || req.headers.authorization) return next()
      res.status(401).json({ message: 'Unauthorized' })
    },
  }
  return load.call(this, request, ...rest)
}
const config = require('../src/api/middlewares.ts').default
Module._load = load

test('account authentication does not cover public password recovery descendants', async () => {
  const app = express()
  // Medusa registers methodless middleware with Express.use, which prefix-matches strings.
  for (const route of config.routes) {
    // Body-parser configuration has no authentication middleware to mount here.
    if (!route.middlewares?.length) continue
    const methods = route.methods || route.method
    if (methods) for (const method of Array.isArray(methods) ? methods : [methods]) app[method.toLowerCase()](route.matcher, ...route.middlewares)
    else app.use(route.matcher, ...route.middlewares)
  }
  for (const path of ['/store/account', '/store/account/settings', '/store/account/marketing', '/store/account/password-reset']) app.post(path, (_req, res) => res.json({ reached: true }))
  const server = app.listen(0, '127.0.0.1')
  try {
    await new Promise(resolve => server.listening ? resolve() : server.once('listening', resolve))
    const base = `http://127.0.0.1:${server.address().port}`
    assert.equal((await fetch(base + '/store/account/password-reset', { method: 'POST' })).status, 200)
    for (const path of ['/store/account', '/store/account/settings', '/store/account/marketing']) assert.equal((await fetch(base + path, { method: 'POST' })).status, 401)
    assert.equal((await fetch(base + '/store/account', { method: 'POST', headers: { Authorization: 'Bearer pending-registration' } })).status, 200)
  } finally { await new Promise(resolve => server.close(resolve)) }
})
