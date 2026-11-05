const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readdirSync } = require('node:fs')
const { resolve, basename } = require('node:path')

test('custom modules use globally unique migration names for the shared migration ledger', () => {
  const root = resolve(__dirname, '../src/modules')
  const migrations = readdirSync(root, { recursive: true }).filter(path => /[/\\]migrations[/\\]Migration\d+\.ts$/.test(path))
  assert.ok(migrations.length > 0)
  const owners = new Map()
  for (const path of migrations) {
    const name = basename(path)
    assert.equal(owners.has(name), false, `${name} is shared by ${owners.get(name)} and ${path}; Medusa would skip one migration`)
    owners.set(name, path)
  }
})
