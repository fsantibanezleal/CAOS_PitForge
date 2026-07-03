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

test('license posture: fetch URLs are remote HTTPS, never local bundle paths', () => {
  for (const r of REAL_CASES) {
    if (r.urls === null) continue;
    for (const u of Object.values(r.urls)) {
      assert.match(u, /^https:\/\//, `${r.id}: must be a remote HTTPS fetch`);
      assert.ok(!u.startsWith('/') && !u.includes('data/derived'), `${r.id}: must not point into the bundle`);
    }
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
