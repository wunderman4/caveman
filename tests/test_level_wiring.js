#!/usr/bin/env node
// Guard against the defect class this fork has now hit twice: an intensity level
// documented in skills/caveman/SKILL.md that the engine never learned.
//
// `precise` shipped as prose only — absent from VALID_MODES, so /caveman precise
// was a no-op that silently fell back to full. It was then added to VALID_MODES
// but not to the statusline whitelists, so the badge hit the reject arm and
// rendered nothing instead of [CAVEMAN:PRECISE].
//
// SKILL.md is the source of truth. Every level row in its intensity table must be
// selectable by the engine and renderable by both statuslines.
//
// Run: node tests/test_level_wiring.js

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'caveman-levelwiring-'));
process.env.XDG_CONFIG_HOME = tmpHome;
delete process.env.CAVEMAN_DEFAULT_MODE;

const { VALID_MODES } = require('../src/hooks/caveman-config');

const repoRoot = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

// Levels declared in the intensity table. Mirrors the row pattern that
// caveman-activate.js filters on, so the two stay in agreement.
const skill = read('skills/caveman/SKILL.md');
const levels = skill
  .split('\n')
  .map((line) => line.match(/^\|\s*\*\*(\S+?)\*\*\s*\|/))
  .filter(Boolean)
  .map((m) => m[1]);

const statuslineSh = read('src/hooks/caveman-statusline.sh');
const statuslinePs1 = read('src/hooks/caveman-statusline.ps1');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

console.log('level wiring: SKILL.md intensity table vs engine whitelists');

test('intensity table parses to a non-empty level list', () => {
  assert.ok(levels.length > 0, 'no | **level** | rows found in skills/caveman/SKILL.md');
});

test('every documented level is in VALID_MODES', () => {
  // wenyan-full is selected via the 'wenyan' alias; activate.js maps it back.
  const missing = levels.filter((l) => !VALID_MODES.includes(l));
  assert.deepStrictEqual(missing, [], `levels absent from VALID_MODES: ${missing.join(', ')}`);
});

test('every documented level is renderable by caveman-statusline.sh', () => {
  const missing = levels.filter((l) => !statuslineSh.includes(l));
  assert.deepStrictEqual(missing, [], `levels absent from the sh whitelist: ${missing.join(', ')}`);
});

test('every documented level is renderable by caveman-statusline.ps1', () => {
  const missing = levels.filter((l) => !statuslinePs1.includes(`'${l}'`));
  assert.deepStrictEqual(missing, [], `levels absent from the ps1 whitelist: ${missing.join(', ')}`);
});

test('the documented default is a real selectable mode', () => {
  const m = skill.match(/^Default:\s*\*\*(\S+?)\*\*/m);
  assert.ok(m, 'no "Default: **level**" line in skills/caveman/SKILL.md');
  assert.ok(VALID_MODES.includes(m[1]), `documented default "${m[1]}" is not in VALID_MODES`);
});

test('every documented level has a worked example line', () => {
  const exampled = new Set(
    skill
      .split('\n')
      .map((line) => line.match(/^- (\S+?):\s/))
      .filter(Boolean)
      .map((m) => m[1])
  );
  // wenyan-lite/ultra carry examples under their own names; every non-wenyan
  // level must too, or activate.js emits a level with no worked example.
  const missing = levels.filter((l) => !l.startsWith('wenyan') && !exampled.has(l));
  assert.deepStrictEqual(missing, [], `levels with no example line: ${missing.join(', ')}`);
});

test('plugin SKILL.md mirror is in sync with the source of truth', () => {
  assert.strictEqual(
    read('plugins/caveman/skills/caveman/SKILL.md'),
    skill,
    'plugins/caveman/skills/caveman/SKILL.md differs from skills/caveman/SKILL.md'
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
