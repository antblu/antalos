const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(process.argv[2], 'utf8');
const sandbox = {
  module: { exports: {} },
  process: { env: new Proxy({ OIDC_ISSUER: 'https://identity.example/' }, {
    get: (values, name) => values[name] || 'test-setting',
  }) },
  require: () => ({ Strategy: class Strategy {} }),
};
vm.runInNewContext(source, sandbox);
const auth = sandbox.module.exports.adminAuth;
function verify(groups, subject = 'subject') {
  let authenticated;
  auth.strategy.options.verify('https://identity.example/',
    { id: subject, _json: { groups } }, { id: 'subject' }, {}, '', '', '', {},
    (error, user) => { assert.equal(error, null); authenticated = user; });
  return authenticated;
}
(async () => {
  const admin = verify(['node-red-users', 'node-red-admins']);
  assert.equal((await auth.users(admin.username)).permissions, '*');
  const user = verify(['node-red-users']);
  assert.equal((await auth.users(user.username)).permissions, 'read');
  assert.equal(verify([]), false);
  assert.equal(verify(undefined), false);
  assert.equal(verify(['node-red-users'], 'other-subject'), false);
  assert.equal(await auth.users('legacy-unscoped-subject'), null);
  console.log('NODE_RED_ROLE_CHECK administrator, read-only user and outsider checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
