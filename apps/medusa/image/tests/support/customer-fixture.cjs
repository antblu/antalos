function fixture() {
  const identities = [], decisions = [], customers = [{ id: 'cus_1', email: 'person@example.com', first_name: 'Jane', last_name: 'Doe', addresses: [] }]
  let clock = 0
  const matches = (row, filters) => Object.entries(filters).every(([key, value]) => value && typeof value === 'object' && '$lte' in value ? row[key] <= value.$lte : Array.isArray(value) ? value.includes(row[key]) : row[key] === value)
  const list = (rows, filters = {}, opts = {}) => {
    const data = rows.filter(r => matches(r, filters))
    if (opts.order) data.sort((a, b) => { for (const [key, direction] of Object.entries(opts.order)) { if (a[key] < b[key]) return direction === 'DESC' ? 1 : -1; if (a[key] > b[key]) return direction === 'DESC' ? -1 : 1 } return 0 })
    return data.slice(opts.skip || 0, (opts.skip || 0) + (opts.take || 10000))
  }
  const service = {
    listIdentities: async (f, o) => list(identities, f, o), listDecisions: async (f, o) => list(decisions, f, o),
    createIdentities: async x => { const row = { id: 'i' + identities.length, ...x }; identities.push(row); return row },
    updateIdentities: async x => Object.assign(identities.find(r => r.id === x.id), x),
    retrieveIdentity: async id => identities.find(r => r.id === id),
    createDecisions: async x => { const row = { id: 'd' + ++clock, created_at: new Date(Date.now() + clock), delivered: false, attempts: 0, ...x }; decisions.push(row); return row },
    updateDecisions: async x => Object.assign(decisions.find(r => r.id === x.id), x),
  }
  const odoo = { contactsEnabled: true, execute: async (model, method) => method === 'search_read' ? [] : method === 'create' ? 10 : true }
  const container = { resolve: name => ({ customer_sync: service, customer: { retrieveCustomer: async id => customers.find(c => c.id === id), listCustomers: async (f = {}, o = {}) => list(customers, f, o) }, locking: { execute: async (_key, fn) => fn() }, logger: { info() {}, warn() {} }, odoo, query: { graph: async () => ({ data: [] }) } })[name] }
  return { container, identities, decisions, customers, service, odoo }
}

module.exports = { fixture };
