// Every case declares a VALIDATION ANCHOR, and docs/cases/README.md tells the reader those anchors
// are checked by the test suite. The 2026-08-18 audit found that claim was false: A02's overhang
// anchor was tested nowhere, A04's halo anchor was tested nowhere, and E01/E02's subset/superset
// anchors were only ever compared as block COUNTS, which is strictly weaker than set inclusion
// (two pits of equal size need not be nested). These tests make the documented claim true.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CASES, caseModel } from '../src/opt/cases.ts';
import { solveUltimatePit, idx } from '../src/opt/index.ts';
import { slopeTemplate, forEachPrecedenceArc } from '../src/opt/precedence.ts';

const caseById = (id: string) => {
  const c = CASES.find((x) => x.id === id);
  assert.ok(c, `case ${id} must exist`);
  return c!;
};

const pitOf = (id: string) => {
  const c = caseById(id);
  const model = caseModel(c);
  return { c, model, pit: solveUltimatePit(model, c.econ) };
};

test('A02 anchor: the precedence cone is honoured, no block is mined under an unmined one', () => {
  const { c, model, pit } = pitOf('A02');
  let overhangs = 0;
  forEachPrecedenceArc(model, slopeTemplate(model, c.econ.slopeAngleDeg), (i, j) => {
    if (pit.inPit[i] && !pit.inPit[j]) overhangs += 1;
  });
  assert.equal(overhangs, 0, 'an overhang means a block is mined with unmined rock above it');
  assert.ok(pit.nBlocks > 0, 'the dipping vein should open a pit at these economics');
});

test('E01 anchor: the low-price pit is a genuine SUBSET of the base-price pit', () => {
  // Set inclusion, not a count comparison: equal cardinality does not imply nesting.
  const low = pitOf('E01');
  const base = pitOf('A01');
  let inLowOnly = 0;
  for (let b = 0; b < low.pit.inPit.length; b += 1) {
    if (low.pit.inPit[b] && !base.pit.inPit[b]) inLowOnly += 1;
  }
  assert.equal(inLowOnly, 0, 'every block of the low-price pit must also be in the base-price pit');
  assert.ok(low.pit.nBlocks <= base.pit.nBlocks, 'and it must not be larger');
});

test('E02 anchor: the high-price pit is a genuine SUPERSET of the base-price pit', () => {
  const high = pitOf('E02');
  const base = pitOf('A01');
  let missing = 0;
  for (let b = 0; b < base.pit.inPit.length; b += 1) {
    if (base.pit.inPit[b] && !high.pit.inPit[b]) missing += 1;
  }
  assert.equal(missing, 0, 'every block of the base-price pit must also be in the high-price pit');
  assert.ok(high.pit.nBlocks >= base.pit.nBlocks, 'and it must not be smaller');
});

test('A04 anchor: raising the revenue factor pulls the low-grade halo IN, monotonically', () => {
  const { c, model } = pitOf('A04');
  let previous = -1;
  const sizes: number[] = [];
  for (const rf of [0.4, 0.6, 0.8, 1.0]) {
    const pit = solveUltimatePit(model, { ...c.econ, revenueFactor: rf });
    sizes.push(pit.nBlocks);
    assert.ok(pit.nBlocks >= previous, `pit must not shrink as rf rises (rf=${rf})`);
    previous = pit.nBlocks;
  }
  assert.ok(sizes[sizes.length - 1] > sizes[0], 'the halo must actually be pulled in by a higher rf');
});

test('CTRL anchor: the closed-form oracle returns its exact 9-block inverted pyramid', () => {
  const { model, pit } = pitOf('CTRL');
  assert.equal(pit.nBlocks, 9, 'a single deep ore block pulls up exactly its 9-block cone');
  assert.ok(Math.abs(pit.pitValue - 2) < 1e-9, `the analytic pit value is 2, got ${pit.pitValue}`);
  assert.ok(pit.inPit[idx(model.dims, 2, 0, 2)], 'the ore block itself must be mined');
});
