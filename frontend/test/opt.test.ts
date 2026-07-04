// Engine correctness, run with: node --import tsx --test test/opt.test.ts
//
// The headline asset is the EXACT optimiser, so it is pinned against hand-computable ground truth: the inverted-
// pyramid oracle (a single deep ore block under a 45° slope drags up a known 9-block cone), the floating-cutoff
// threshold (below break-even the optimal pit is empty), nested-shell monotonicity, and the max-flow value identity.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type BlockModel,
  type EconParams,
  idx,
  makeDeposit,
  nestedPitShells,
  defaultRevenueFactors,
  solveUltimatePit,
} from '../src/opt/index.ts';

// A 5×1×3 vertical slice with all-waste grade except one block we set by hand. Cubic 10 m blocks, tonnage 1 (so
// mining cost 1 = 1 unit of value per block), processingCost 0 → waste value = −1, ore value = price·grade − 1.
function slice(valuableIx: number, valuableIz: number, valuableGrade: number): BlockModel {
  const dims = { nx: 5, ny: 1, nz: 3 };
  const N = dims.nx * dims.ny * dims.nz;
  const grade = new Float64Array(N);
  const tonnage = new Float64Array(N).fill(1);
  const density = new Float64Array(N).fill(2.7);
  grade[idx(dims, valuableIx, 0, valuableIz)] = valuableGrade;
  return { dims, block: { dx: 10, dy: 10, dz: 10 }, tonnage, density, grade, meta: { name: 't', archetype: 'test', gradeUnit: 'frac' } };
}

const ECON = (price: number): EconParams => ({
  price,
  recovery: 1,
  miningCost: 1,
  processingCost: 0,
  slopeAngleDeg: 45,
});

test('inverted-pyramid oracle: a deep ore block pulls up exactly its 9-block cone', () => {
  // value of the deep block = price·grade − 1 = 11·1 − 1 = 10; the 8 overlying waste blocks cost 1 each.
  const model = slice(2, 2, 1);
  const pit = solveUltimatePit(model, ECON(11));
  assert.equal(pit.nBlocks, 9, 'the inverted pyramid is 5 (top) + 3 (mid) + 1 (deep) = 9 blocks');
  // the deep block + its full cone are in:
  const must = [
    [2, 2],
    [1, 1], [2, 1], [3, 1],
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
  ];
  for (const [ix, iz] of must) assert.equal(pit.inPit[idx(model.dims, ix, 0, iz)], 1, `(${ix},${iz}) must be in`);
  // blocks outside the cone are out:
  for (const [ix, iz] of [[0, 1], [4, 1], [0, 2], [1, 2], [3, 2], [4, 2]]) {
    assert.equal(pit.inPit[idx(model.dims, ix, 0, iz)], 0, `(${ix},${iz}) must be out`);
  }
  assert.ok(Math.abs(pit.pitValue - 2) < 1e-6, `pit value = 10 − 8 = 2 (got ${pit.pitValue})`);
});

test('floating cutoff / break-even: below the cost-to-reach, the optimal pit is empty', () => {
  // deep block value = 6·1 − 1 = 5, but reaching it costs 8 → not worth mining → empty pit.
  const pit = solveUltimatePit(slice(2, 2, 1), ECON(6));
  assert.equal(pit.nBlocks, 0);
  assert.equal(pit.pitValue, 0);
});

test('max-flow value identity holds (pitValue = ΣpositiveValue − maxflow)', () => {
  const model = makeDeposit({ archetype: 'porphyry', dims: { nx: 16, ny: 16, nz: 8 }, seed: 7, peakGrade: 0.03 });
  const pit = solveUltimatePit(model, { price: 6000, recovery: 0.88, miningCost: 2.5, processingCost: 9, slopeAngleDeg: 45 });
  assert.ok(pit.nBlocks > 0, 'a porphyry at these prices should open a pit');
  assert.ok(Math.abs(pit.pitValue - (pit.sumPositive - pit.maxflow)) < 1e-3, 'value identity');
});

test('nested shells are monotone: pit grows with the revenue factor', () => {
  const model = makeDeposit({ archetype: 'coreHalo', dims: { nx: 14, ny: 14, nz: 7 }, seed: 3, peakGrade: 0.04 });
  const econ: EconParams = { price: 6000, recovery: 0.88, miningCost: 2.5, processingCost: 9, slopeAngleDeg: 45 };
  const shells = nestedPitShells(model, econ, defaultRevenueFactors(10));
  for (let k = 1; k < shells.curve.length; k++) {
    assert.ok(shells.curve[k].nBlocks >= shells.curve[k - 1].nBlocks, `shell ${k} must not shrink`);
    assert.ok(shells.curve[k].pitValue >= shells.curve[k - 1].pitValue - 1e-3, `value ${k} must not drop`);
  }
  assert.ok(shells.curve[shells.curve.length - 1].nBlocks > 0, 'the full-price pit is non-empty');
});

test('deposit generation is deterministic for a fixed seed', () => {
  const a = makeDeposit({ archetype: 'vein', dims: { nx: 10, ny: 10, nz: 5 }, seed: 42 });
  const b = makeDeposit({ archetype: 'vein', dims: { nx: 10, ny: 10, nz: 5 }, seed: 42 });
  assert.deepEqual(Array.from(a.grade), Array.from(b.grade));
});
