// MineLib lane tests. Two layers:
// (1) always-on: parsers on FABRICATED fixtures (our own strings in the MineLib format — no
//     licensed data committed) + solveUpitExplicit on hand-computable instances.
// (2) local-only ORACLE: when the gitignored .minelib-cache holds newman1 (scripts/fetch-minelib.mjs),
//     the full parse→solve pipeline must reproduce the PUBLISHED optimum 26,086,899. CI never
//     fetches MineLib, so this layer skips there — the fabricated layer still guards the code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRealEmbedding, parseBlocks, parseMinelib, parsePrec, parseUpit, solveUpitExplicit } from '../src/opt/minelib.ts';
import { REAL_CASES } from '../src/opt/realCases.ts';

const CACHES = join(dirname(fileURLToPath(import.meta.url)), '..', '.minelib-cache');
const CACHE = join(CACHES, 'newman1');

// ---- fabricated fixtures (our own content, MineLib format) ----------------------------------
const FIX_BLOCKS = `0 0 0 1 AA 0.5 100 2.7 -10 40 0
1 0 0 0 BB 0.0 100 2.7 -10 -10 0
2 1 0 1 AA 0.9 100 2.7 -10 90 0`;
const FIX_PREC = `0 1 1
1 0
2 1 1`;
const FIX_UPIT = `NAME: Fix
TYPE: UPIT
NBLOCKS: 3
OBJECTIVE_FUNCTION:
0 40
1 -10
2 90`;

test('parseBlocks reads coords + declared free columns', () => {
  const b = parseBlocks(FIX_BLOCKS, { grade: 5, tonnage: 6, density: 7 });
  assert.equal(b.n, 3);
  assert.deepEqual([...b.z], [1, 0, 1]);
  assert.equal(b.grade![2], 0.9);
  assert.equal(b.tonnage![0], 100);
  assert.equal(b.density![1], 2.7);
});

test('parseBlocks skips a column-name header row (kd mirror format)', () => {
  const b = parseBlocks(`id x y z tonn grade\n${FIX_BLOCKS}`, { grade: 5 });
  assert.equal(b.n, 3);
  assert.equal(b.grade![2], 0.9);
});

test('parsePrec builds the CSR predecessor lists', () => {
  const p = parsePrec(FIX_PREC, 3);
  assert.equal(p.nPrecs, 2);
  assert.deepEqual([...p.precStart], [0, 1, 1, 2]);
  assert.deepEqual([...p.precList], [1, 1]);
});

test('parseUpit skips the header and requires every block value', () => {
  const v = parseUpit(FIX_UPIT, 3);
  assert.deepEqual([...v], [40, -10, 90]);
  assert.throws(() => parseUpit('NAME: x\n0 1', 2), /missing value/);
});

test('solveUpitExplicit: profitable closure taken whole', () => {
  // 0 and 2 pay (40+90), both require 1 (−10): optimum = all three, value 120.
  const p = parsePrec(FIX_PREC, 3);
  const r = solveUpitExplicit(new Float64Array([40, -10, 90]), p.precStart, p.precList);
  assert.equal(r.nInPit, 3);
  assert.equal(r.pitValue, 120);
  assert.equal(r.pitValue, r.sumPositive - r.maxflow);
});

test('solveUpitExplicit: unprofitable closure left in the ground', () => {
  // one +5 block buried under two −4 blocks → mining it nets −3: optimal pit is EMPTY.
  const prec = parsePrec('0 2 1 2\n1 0\n2 0', 3);
  const r = solveUpitExplicit(new Float64Array([5, -4, -4]), prec.precStart, prec.precList);
  assert.equal(r.nInPit, 0);
  assert.equal(r.pitValue, 0);
});

test('solveUpitExplicit: partial pit picks only the paying branch', () => {
  // two independent branches over a shared surface? No — two separate chains:
  //   3 (+20) over 4 (−5): pays → in. 0 (+5) over 1,2 (−4,−4): loses → out.
  const prec = parsePrec('0 2 1 2\n1 0\n2 0\n3 1 4\n4 0', 5);
  const r = solveUpitExplicit(new Float64Array([5, -4, -4, 20, -5]), prec.precStart, prec.precList);
  assert.equal(r.nInPit, 2);
  assert.equal(r.pitValue, 15);
});

test('buildRealEmbedding: sparse box, z flipped to the viz convention, duplicates rejected', () => {
  const inst = parseMinelib({ blocks: FIX_BLOCKS, prec: FIX_PREC, upit: FIX_UPIT }, { grade: 5 });
  const e = buildRealEmbedding(inst, 'fix');
  assert.deepEqual(e.dims, { nx: 2, ny: 1, nz: 2 });
  // block 1 sits at published z=0 (lowest) → viz z=1 (deepest); blocks 0/2 at z=1 → viz z=0.
  const present = [...e.present];
  assert.equal(present.reduce((a, b) => a + b, 0), 3);
  assert.equal(e.gradeAvailable, true);
  assert.equal(e.tonnageAvailable, false);
});

// ---- the published-optimum oracle (local cache only; CI skips) -------------------------------
const hasCache = existsSync(join(CACHE, 'newman1.upit'));

test('newman1 reproduces the PUBLISHED UPIT optimum 26,086,899', { skip: !hasCache && 'no .minelib-cache (run scripts/fetch-minelib.mjs)' }, () => {
  const rc = REAL_CASES.find((r) => r.id === 'newman1')!;
  const txt = {
    blocks: readFileSync(join(CACHE, 'newman1.blocks'), 'utf8'),
    prec: readFileSync(join(CACHE, 'newman1.prec'), 'utf8'),
    upit: readFileSync(join(CACHE, 'newman1.upit'), 'utf8'),
  };
  const inst = parseMinelib(txt, rc.blocksLayout);
  assert.equal(inst.n, rc.nBlocks);
  assert.equal(inst.nPrecs, rc.nPrecs);

  const t0 = performance.now();
  const r = solveUpitExplicit(inst.value, inst.precStart, inst.precList);
  const ms = performance.now() - t0;
  console.log(`  newman1: pitValue=${r.pitValue} published=${rc.publishedOptimum} Δ=${r.pitValue - rc.publishedOptimum} in ${ms.toFixed(0)} ms, ${r.nInPit}/${inst.n} blocks`);
  assert.ok(Math.abs(r.pitValue - rc.publishedOptimum) <= 1e-6 * rc.publishedOptimum,
    `pitValue ${r.pitValue} != published ${rc.publishedOptimum}`);

  const e = buildRealEmbedding(inst, rc.name);
  assert.equal([...e.present].reduce((a, b) => a + b, 0), rc.nBlocks);
  assert.ok(e.gradeAvailable && e.tonnageAvailable);
});

// zuck_small + kd oracles (same pattern; ~250 ms solves — local only)
for (const id of ['zuck_small', 'kd']) {
  const dir = join(CACHES, id);
  const cached = existsSync(join(dir, `${id}.upit`));
  test(`${id} reproduces the PUBLISHED UPIT optimum`, { skip: !cached && 'no .minelib-cache (run scripts/fetch-minelib.mjs)' }, () => {
    const rc = REAL_CASES.find((r) => r.id === id)!;
    const inst = parseMinelib({
      blocks: readFileSync(join(dir, `${id}.blocks`), 'utf8'),
      prec: readFileSync(join(dir, `${id}.prec`), 'utf8'),
      upit: readFileSync(join(dir, `${id}.upit`), 'utf8'),
    }, rc.blocksLayout);
    assert.equal(inst.n, rc.nBlocks);
    assert.equal(inst.nPrecs, rc.nPrecs);
    const r = solveUpitExplicit(inst.value, inst.precStart, inst.precList);
    assert.ok(Math.abs(r.pitValue - rc.publishedOptimum) <= 1e-6 * rc.publishedOptimum,
      `pitValue ${r.pitValue} != published ${rc.publishedOptimum}`);
  });
}
