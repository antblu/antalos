// Run inside the repository's Renovate image; uses Renovate's real RE2 extractor.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { RegExpVersioningApi } from '/usr/local/renovate/dist/modules/versioning/regex/index.js';
import { extractPackageFile } from '/usr/local/renovate/dist/modules/manager/custom/regex/index.js';

const root = process.cwd();
const config = JSON.parse(fs.readFileSync('renovate.json', 'utf8'));
const read = (name) => fs.readFileSync(name, 'utf8');
function walk(dir) {
  return execFileSync('git', ['-c', `safe.directory=${root}`, 'ls-files', '--cached', '--others', '--exclude-standard', '--', dir], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
}
const versionFiles = ['apps/variables.yaml', ...walk('infrastructure/ansible').filter((name) => name.endsWith('/variables.yaml'))];
const contracts = new Map([
  ['NEXTCLOUD_SERVER_VERSION', 'Persisted Nextcloud config.php version, migrated with the server; not an independent release'],
  ['NEXTCLOUD_NFS_VERSION', 'NFS protocol selection'],
  ['CONTEXT_CHAT_APPAPI_VERSION', 'AppAPI protocol compatibility contract'],
]);
const errors = [];
const counts = {};
const extracted = [];
for (const file of versionFiles) {
  const content = read(file);
  const deps = config.customManagers.flatMap((manager) => {
    const matches = manager.managerFilePatterns.some((pattern) => new RegExp(pattern.slice(1, -1)).test(file));
    return matches ? extractPackageFile(content, file, manager)?.deps ?? [] : [];
  });
  extracted.push(...deps.map((dep) => ({ ...dep, file })));
  counts[file] = deps.length;
  for (const line of content.split('\n')) {
    const match = /^\s*([A-Za-z][A-Za-z0-9_]*):\s*(.+)$/.exec(line);
    if (!match) continue;
    const [, key, value] = match;
    const isPin = /(?:_VERSION|_IMAGE_TAG|_BASE_IMAGE|_version|_image)$/.test(key) || /^ODOO_OCA_.*_REVISION$/.test(key) || key === 'SUITECRM_IMAGE_DIGEST';
    if (!isPin || contracts.has(key)) continue;
    if (!deps.some((dep) => dep.replaceString.includes(`${key}:`))) errors.push(`${file}: ${key} is not extracted by Renovate`);
  }
  // Every annotation must extract, including optional metadata and quoted pins.
  const annotated = [...content.matchAll(/# renovate(?:-image)?:[^\n]+\n[ \t]*([A-Za-z][A-Za-z0-9_]*):/g)];
  for (const [, key] of annotated) {
    if (!deps.some((dep) => dep.replaceString.includes(`${key}:`))) errors.push(`${file}: broken annotation for ${key}`);
  }
}
const variables = read('apps/variables.yaml');
const trackedKeys = new Set(extracted.flatMap((dep) => [...dep.replaceString.matchAll(/(?:^|\n)[ \t]*([A-Za-z][A-Za-z0-9_]*):/g)].map((match) => match[1].toUpperCase())));
const definedKeys = new Set(versionFiles.flatMap((file) => [...read(file).matchAll(/^[ \t]*([A-Za-z][A-Za-z0-9_]*):/gm)].map((match) => match[1].toUpperCase())));
for (const file of walk('apps').filter((name) => name.endsWith('/app.yaml'))) {
  for (const [, key] of read(file).matchAll(/targetRevision: \$\{([^}]+)\}/g)) {
    assert(extracted.some((dep) => dep.datasource === 'helm' && dep.replaceString.includes(`${key}:`)), `${file}: untracked chart ${key}`);
  }
}
for (const file of [...walk('apps'), ...walk('infrastructure/ansible')]) {
  if (file.endsWith('variables.yaml') || !/(?:\.ya?ml|Dockerfile(?:\.[^/]+)?)$/.test(file)) continue;
  for (const line of read(file).split('\n')) {
    if (/^\s*#/.test(line)) continue;
    const image = /^\s*image(?:Name)?:\s*(\S.*)$/.exec(line)?.[1];
    if (image) {
      for (const match of image.matchAll(/\$\{([A-Z_]+)\}|\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g)) {
        const key = (match[1] ?? match[2]).toUpperCase();
        if (!definedKeys.has(key)) errors.push(`${file}: undefined image variable ${key}`);
        else if (!key.endsWith('_REPOSITORY') && !trackedKeys.has(key)) errors.push(`${file}: image variable ${key} is not tracked`);
      }
    }
    if (image && !image.includes('${') && !image.includes('{{') && !/^['"]{2}(?:\s|$)/.test(image)) {
      errors.push(`${file}: literal image pin must move to variables.yaml: ${image}`);
    }
    if (/^FROM\s+/i.test(line) && !line.includes('${') && !/^FROM\s+(?:scratch|build)(?:\s|$)/i.test(line)) errors.push(`${file}: literal Dockerfile base image`);
    if (/^ARG\s+\w*(?:IMAGE|VERSION|TAG)\w*=/.test(line)) errors.push(`${file}: hardcoded build-argument default`);
  }
}
const authentik = extracted.find((dep) => dep.depName === 'authentik');
assert.equal(authentik?.currentValue, /^  AUTHENTIK_CHART_VERSION: (.+)$/m.exec(variables)?.[1]);
assert(authentik?.registryUrls?.some((url) => url.startsWith('https://charts.goauthentik.io')));
for (const dep of extracted.filter((dep) => dep.datasource === 'git-refs')) {
  assert.equal(dep.currentValue, '19.0');
  assert.match(dep.currentDigest, /^[a-f0-9]{40}$/);
}
const suitecrm = extracted.find((dep) => dep.depName === 'ghcr.io/antblu/suitecrm');
assert.match(suitecrm?.currentDigest ?? '', /^sha256:[a-f0-9]{64}$/);
// Revision suffixes are builds, not Docker flavor constraints.
for (const [pkg, oldTag, newTag] of [
  ['ghcr.io/antblu/antalos-medusa', '2.22.0-5', '2.22.0-6'],
  ['ghcr.io/antblu/mautic', '7.2.1-1010-v3', '7.2.1-1010-v4'],
  ['ghcr.io/zammad/zammad', '7.1.3-0006', '7.1.3-0007'],
  ['intel/pytorch', 'xpu-2.13.0-ubuntu24.04-20260907', 'xpu-2.13.0-ubuntu24.04-20260908'],
  ['jellyfin/jellyfin', '12.0.20260908-012347', '12.0.20260908-012348'],
]) {
  const rule = config.packageRules.find((item) => item.matchPackageNames?.includes(pkg) && item.versioning?.startsWith('regex:'));
  assert(rule, `${pkg}: missing numeric-build versioning`);
  const versioning = new RegExpVersioningApi(rule.versioning.slice(6));
  assert(versioning.isValid(oldTag));
  assert(versioning.isGreaterThan(newTag, oldTag), `${pkg}: build updates are invisible`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Renovate extracts ${extracted.length} centralized dependencies:`);
  for (const [file, count] of Object.entries(counts)) console.log(`  ${file}: ${count}`);
  console.log(`Protocol/runtime contracts: ${[...contracts.keys()].join(', ')}`);
}
