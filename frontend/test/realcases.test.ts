// Registry guards for the real-data lane (MineLib). Two invariants matter here:
// (1) the summary facts must match the published record exactly (they are the oracle the exact
//     solver is later asserted against), and
// (2) the license posture must hold structurally — runtime-fetch URLs only, never bundled paths.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REAL_CASES } from '../src/opt/realCases.ts';

test('registry ids are unique and non-empty', () => {
  const ids = REAL_CASES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 3);
});

test('published facts match the MineLib record (Espinoza et al. 2013)', () => {
  const byId = Object.fromEntries(REAL_CASES.map((r) => [r.id, r]));
  assert.equal(byId.newman1.nBlocks, 1060);
  assert.equal(byId.newman1.nPrecs, 3922);
  assert.equal(byId.newman1.publishedOptimum, 26_086_899);
  assert.equal(byId.zuck_small.nBlocks, 9400);
  assert.equal(byId.zuck_small.publishedOptimum, 1_422_726_898);
  assert.equal(byId.kd.nBlocks, 14_153);
  assert.equal(byId.kd.publishedOptimum, 652_195_037);
});

test('license posture: PUBLISHED MineLib instances fetch from remote HTTPS, never bundled', () => {
  // synthetic twins are OUR data (no MineLib license) and are committed + served locally — exempt.
  for (const r of REAL_CASES) {
    if (r.urls === null || r.synthetic) continue;
    for (const u of Object.values(r.urls)) {
      assert.match(u, /^https:\/\//, `${r.id}: published instance must be a remote HTTPS fetch`);
      assert.ok(!u.includes('data/derived'), `${r.id}: must not point into the derived bundle`);
    }
  }
});

test('synthetic twins are committed locally (not remote), with a stamped optimum', () => {
  const twins = REAL_CASES.filter((r) => r.synthetic);
  assert.ok(twins.length >= 2, 'expected the oreblocks synthetic twins');
  for (const r of twins) {
    assert.ok(r.urls, `${r.id}: twin needs local urls`);
    for (const u of Object.values(r.urls!)) {
      assert.ok(!/^https?:\/\//.test(u), `${r.id}: twin must be served locally, not fetched remotely`);
      assert.match(u, /twins\//, `${r.id}: twin url must point at the committed twins dir`);
    }
    assert.ok(r.publishedOptimum > 0 && r.nBlocks > 0 && r.nPrecs > 0);
  }
});

test('gates are valid and provenance is bilingual', () => {
  for (const r of REAL_CASES) {
    assert.ok(['live', 'size-gated', 'offline-only'].includes(r.gate), r.id);
    assert.ok(r.provenance_en.length > 10 && r.provenance_es.length > 10, r.id);
    assert.ok(r.nBlocks > 0 && r.nPrecs > 0 && r.publishedOptimum > 0, r.id);
  }
  // the live-on-select instance must actually have fetch endpoints
  for (const r of REAL_CASES.filter((x) => x.gate === 'live')) assert.ok(r.urls, `${r.id}: live gate needs urls`);
});
