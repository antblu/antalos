// Run from the repository root: node .github/tests/select-runner.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const workflow = fs.readFileSync(path.join(__dirname, '../workflows/select-runner.yaml'), 'utf8');
const script = workflow.split('          script: |\n')[1].split('\n      - name:')[0]
  .split('\n').map(line => line.slice(12)).join('\n');
const hosted = '["ubuntu-latest"]';
const selfHosted = '["self-hosted","Linux","X64","antalos"]';
async function select({mode = 'auto', event = 'push', status = 'completed', conclusion = 'success', error = false, visible = true} = {}) {
  const outputs = {};
  let dispatched = 0;
  let polled = 0;
  const context = {repo: {owner: 'antblu', repo: 'antalos'}, eventName: event, runId: 123,
    payload: {repository: {default_branch: 'main'}}};
  const github = {rest: {actions: {
    createWorkflowDispatch: async input => {
      assert.equal(input.ref, 'main');
      dispatched++;
      if (error) throw Object.assign(new Error(), {status: 403});
    },
    listWorkflowRuns: async () => {
      polled++;
      return {data: {workflow_runs: visible ? [{id: 456, display_title: 'runner-probe-123-select-1', status, conclusion}] : []}};
    },
  }}};
  const scope = vm.createContext({context, github,
    core: {setOutput: (k, v) => outputs[k] = v, info() {}, warning() {}},
    process: {env: {REQUESTED_RUNNER: mode, GITHUB_JOB: 'select', GITHUB_RUN_ATTEMPT: '1'}},
    setTimeout: fn => fn(),
  });
  await vm.runInContext(`(async () => {${script}\n})()`, scope);
  return {outputs, dispatched, polled};
}
(async () => {
  assert.equal((await select()).outputs.runner, selfHosted);
  const busy = await select({status: 'queued'});
  assert.equal(busy.outputs.runner, hosted);
  assert.equal(busy.polled, 12);
  assert.equal(busy.outputs['probe-id'], '456');
  assert.equal((await select({conclusion: 'failure'})).outputs.runner, hosted);
  assert.equal((await select({error: true})).outputs.runner, hosted);
  assert.equal((await select({visible: false})).outputs.runner, hosted);
  const pr = await select({event: 'pull_request', mode: 'self-hosted'});
  assert.equal(pr.outputs.runner, hosted);
  assert.equal(pr.dispatched, 0);
  const forcedHosted = await select({mode: 'ubuntu-latest'});
  assert.equal(forcedHosted.outputs.runner, hosted);
  assert.equal(forcedHosted.dispatched, 0);
  const forcedSelfHosted = await select({mode: 'self-hosted'});
  assert.equal(forcedSelfHosted.outputs.runner, selfHosted);
  assert.equal(forcedSelfHosted.dispatched, 0);
  await assert.rejects(() => select({mode: 'invalid'}));
  console.log('9 runner selection scenarios passed');
})().catch(error => {console.error(error); process.exitCode = 1;});
