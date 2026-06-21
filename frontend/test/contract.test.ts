// CONTRACT 2 (frontend side) — the baked case-results.json must conform to the TS mirror and carry the invariants the
// App relies on. Run with: node --import tsx --test test/contract.test.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { CaseResultsFile } from '../src/lib/contract.types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const data: CaseResultsFile = JSON.parse(
  readFileSync(resolve(HERE, '../../data/derived/case-results.json'), 'utf-8'),
);

test('case-results.json has the expected schema + all 9 cases', () => {
  assert.equal(data.schema, 'pitforge.case-results/v1');
  assert.equal(data.nCases, 9);
  for (const id of ['A01', 'A02', 'A03', 'A04', 'E01', 'E02', 'G01', 'G02', 'CTRL']) {
    assert.ok(data.cases[id], `missing case ${id}`);
  }
});

test('the CTRL oracle is exactly the inverted pyramid (value 2, 9 blocks)', () => {
  const u = data.cases.CTRL.ultimate;
  assert.equal(u.pitValue, 2);
  assert.equal(u.nBlocks, 9);
});

test('every Whittle curve is monotone (pit grows with the revenue factor)', () => {
  for (const [id, c] of Object.entries(data.cases)) {
    for (let k = 1; k < c.curve.length; k++) {
      assert.ok(c.curve[k].nBlocks >= c.curve[k - 1].nBlocks, `${id}: shell ${k} shrank`);
      assert.ok(c.curve[k].pitValue >= c.curve[k - 1].pitValue - 1, `${id}: value ${k} dropped`);
    }
  }
});

test('the economic + slope anchors hold across cases', () => {
  const n = (id: string) => data.cases[id].ultimate.nBlocks;
  const v = (id: string) => data.cases[id].ultimate.pitValue;
  assert.ok(n('E01') < n('A01'), 'low price → smaller pit');
  assert.ok(n('E02') > n('A01'), 'high price → bigger pit');
  assert.ok(v('A01') >= v('G01') && v('G01') >= v('G02'), 'flatter walls → more stripping → lower value');
});
