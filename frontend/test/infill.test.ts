// Pure-logic tests for the grade-infill what-if tool (lib/infill.ts). The stencil semantics must
// mirror the training contract (science/train_pit.py + gen_train.mjs): 27-vec in dz→dy→dx order,
// centre (flat 13) always 0, unknown/out-of-bounds neighbours 0; IDW = the benchmark baseline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assembleEstimated, buildInfillTargets, coordsOf, drillMask, idwFromStencil, rmseOnTargets,
  STENCIL_OFFSETS, stencilAt,
} from '../src/lib/infill.ts';
import { idx, type BlockModel } from '../src/opt/types.ts';

const mk = (nx: number, ny: number, nz: number, grade: (i: number) => number): BlockModel => {
  const N = nx * ny * nz;
  const g = new Float64Array(N);
  for (let i = 0; i < N; i++) g[i] = grade(i);
  return {
    dims: { nx, ny, nz }, block: { dx: 10, dy: 10, dz: 10 },
    tonnage: new Float64Array(N).fill(2700), density: new Float64Array(N).fill(2.7), grade: g,
    meta: { name: 't', archetype: 't', gradeUnit: 'mass fraction' },
  };
};

test('stencil order matches the training contract (centre at flat index 13)', () => {
  assert.equal(STENCIL_OFFSETS.length, 27);
  assert.deepEqual(STENCIL_OFFSETS[13], [0, 0, 0]);
  assert.deepEqual(STENCIL_OFFSETS[0], [-1, -1, -1]); // dz outer … dx inner
  assert.deepEqual(STENCIL_OFFSETS[26], [1, 1, 1]);
});

test('drillMask is deterministic, respects fraction and the present mask', () => {
  const a = drillMask(10_000, 0.25, 7);
  const b = drillMask(10_000, 0.25, 7);
  assert.deepEqual([...a], [...b]);
  const frac = [...a].reduce((s: number, v: number) => s + v, 0) / 10_000;
  assert.ok(Math.abs(frac - 0.25) < 0.02, `got ${frac}`);
  const present = new Uint8Array(10_000); // nothing present → nothing drilled
  assert.equal([...drillMask(10_000, 0.9, 7, present)].reduce((s: number, v: number) => s + v, 0), 0);
});

test('stencilAt: centre masked, out-of-bounds and undrilled are 0, drilled carry the grade', () => {
  const m = mk(3, 3, 3, (i) => (i + 1) / 100);
  const drilled = new Uint8Array(27).fill(1);
  drilled[idx(m.dims, 0, 1, 1)] = 0; // (0,1,1) undrilled
  const out = new Float32Array(27);
  stencilAt(m, drilled, 1, 1, 1, out, 0);
  assert.equal(out[13], 0); // the centre is ALWAYS masked
  const kUndrilled = STENCIL_OFFSETS.findIndex(([dx, dy, dz]) => dx === -1 && dy === 0 && dz === 0);
  assert.equal(out[kUndrilled], 0);
  const kDrilled = STENCIL_OFFSETS.findIndex(([dx, dy, dz]) => dx === 1 && dy === 0 && dz === 0);
  assert.ok(Math.abs(out[kDrilled] - m.grade[idx(m.dims, 2, 1, 1)]) < 1e-6); // float32 storage
  // corner block: 19 of 26 neighbours out of bounds → zeros
  const cOut = new Float32Array(27);
  stencilAt(m, drilled, 0, 0, 0, cOut, 0);
  const zeros = [...cOut].filter((v) => v === 0).length;
  assert.ok(zeros >= 19 + 1); // OOB + the centre
});

test('idwFromStencil matches the hand-computed benchmark baseline', () => {
  const s = new Float32Array(27);
  const k1 = STENCIL_OFFSETS.findIndex(([dx, dy, dz]) => dx === 1 && dy === 0 && dz === 0);  // dist 1
  const k2 = STENCIL_OFFSETS.findIndex(([dx, dy, dz]) => dx === 1 && dy === 1 && dz === 1);  // dist √3
  s[k1] = 0.4;
  s[k2] = 0.1;
  const w2 = 1 / Math.sqrt(3);
  const expected = (0.4 * 1 + 0.1 * w2) / (1 + w2);
  assert.ok(Math.abs(idwFromStencil(s) - expected) < 1e-6); // float32 storage
  assert.equal(idwFromStencil(new Float32Array(27)), 0); // nothing known → 0
});

test('buildInfillTargets + assemble + rmse round-trip', () => {
  const m = mk(4, 4, 4, (i) => 0.01 + (i % 5) / 100);
  const drilled = drillMask(64, 0.5, 3);
  const { targets, stencils } = buildInfillTargets(m, drilled);
  assert.equal(targets.length, 64 - [...drilled].reduce((s: number, v: number) => s + v, 0));
  assert.equal(stencils.length, targets.length * 27);
  for (const t of targets) assert.equal(drilled[t], 0);
  const [ix, iy, iz] = coordsOf(m.dims, targets[0]);
  assert.equal(idx(m.dims, ix, iy, iz), targets[0]);

  const est = new Float64Array(targets.length).fill(-0.5); // negative estimates must clamp to 0
  const em = assembleEstimated(m, drilled, targets, est, 'x');
  for (const t of targets) assert.equal(em.grade[t], 0);
  for (let i = 0; i < 64; i++) if (drilled[i]) assert.equal(em.grade[i], m.grade[i]);

  const perfect = Float64Array.from(targets, (t: number) => m.grade[t]);
  assert.equal(rmseOnTargets(m, targets, perfect), 0);
  assert.ok(rmseOnTargets(m, targets, est) > 0);
});
