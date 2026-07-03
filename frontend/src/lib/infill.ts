// Grade-infill what-if — the pure logic under viz/InfillPanel.tsx (kept UI-free so tests cover it).
//
// The question the tool answers: with only a FRACTION of the blocks drilled (grades known), how
// well does each infill method recover the deposit — and what does that do to the EXACT pit?
// Stencil contract (mirrors science/train_pit.py + gen_train.mjs): a flat 27-vector over the
// 3×3×3 neighbourhood in dz→dy→dx order; the centre (flat index 13) is ALWAYS 0 (that is the
// value being estimated); unknown/undrilled/out-of-bounds neighbours are 0. grade-nn takes the
// raw 27-vec; the IDW baseline weights the >0 entries by inverse distance — exactly the
// benchmark implementation the model was measured against.

import { type BlockModel, type GridDims, idx } from '../opt/types.ts';

/** the 27 offsets in the training order (dz outer, dy, dx inner); flat index 13 = the centre. */
export const STENCIL_OFFSETS: [number, number, number][] = [];
for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) STENCIL_OFFSETS.push([dx, dy, dz]);
const STENCIL_DIST = STENCIL_OFFSETS.map(([dx, dy, dz]) => Math.hypot(dx, dy, dz));

/** Deterministic drill mask: fraction of (present) blocks marked drilled=1. mulberry32-seeded. */
export function drillMask(n: number, fraction: number, seed: number, present?: Uint8Array | null): Uint8Array {
  let a = seed >>> 0;
  const rnd = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (present && !present[i]) continue;
    if (rnd() < fraction) mask[i] = 1;
  }
  return mask;
}

/** Build the 27-stencil (training order/semantics) for block i from DRILLED grades only. */
export function stencilAt(model: BlockModel, drilled: Uint8Array, ix: number, iy: number, iz: number, out: Float32Array, at: number): void {
  const { nx, ny, nz } = model.dims;
  for (let k = 0; k < 27; k++) {
    const [dx, dy, dz] = STENCIL_OFFSETS[k];
    if (!dx && !dy && !dz) { out[at + k] = 0; continue; } // the centre is always masked
    const jx = ix + dx;
    const jy = iy + dy;
    const jz = iz + dz;
    if (jx < 0 || jx >= nx || jy < 0 || jy >= ny || jz < 0 || jz >= nz) { out[at + k] = 0; continue; }
    const j = idx(model.dims, jx, jy, jz);
    out[at + k] = drilled[j] ? model.grade[j] : 0;
  }
}

/** IDW estimate from a 27-stencil — the exact classical baseline grade-nn was benchmarked against. */
export function idwFromStencil(stencil: Float32Array, at = 0): number {
  let wsum = 0;
  let vsum = 0;
  for (let k = 0; k < 27; k++) {
    const v = stencil[at + k];
    const d = STENCIL_DIST[k];
    if (v > 0 && d > 0) { const w = 1 / d; wsum += w; vsum += w * v; }
  }
  return wsum > 0 ? vsum / wsum : 0;
}

export interface InfillTargets {
  /** flat indices of the blocks to estimate (present but undrilled). */
  targets: Int32Array;
  /** (targets.length × 27) stencils in the training order. */
  stencils: Float32Array;
}

/** Collect every present-but-undrilled block + its stencil (one batched NN call downstream). */
export function buildInfillTargets(model: BlockModel, drilled: Uint8Array, present?: Uint8Array | null): InfillTargets {
  const { nx, ny, nz } = model.dims;
  const list: number[] = [];
  for (let iz = 0; iz < nz; iz++) for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
    const i = idx(model.dims, ix, iy, iz);
    if (present && !present[i]) continue;
    if (!drilled[i]) list.push(i);
  }
  const targets = Int32Array.from(list);
  const stencils = new Float32Array(targets.length * 27);
  let at = 0;
  for (const i of targets) {
    const iz = Math.floor(i / (nx * ny));
    const iy = Math.floor((i - iz * nx * ny) / nx);
    const ix = i - (iz * ny + iy) * nx;
    stencilAt(model, drilled, ix, iy, iz, stencils, at);
    at += 27;
  }
  return { targets, stencils };
}

/** Assemble an estimated model: drilled blocks keep the true grade; targets take the estimates (clamped ≥0). */
export function assembleEstimated(model: BlockModel, drilled: Uint8Array, targets: Int32Array, est: ArrayLike<number>, name: string): BlockModel {
  const grade = Float64Array.from(model.grade);
  for (let t = 0; t < targets.length; t++) {
    const i = targets[t];
    grade[i] = drilled[i] ? model.grade[i] : Math.max(0, Number(est[t]) || 0);
  }
  return { ...model, grade, meta: { ...model.meta, name } };
}

/** RMSE of the estimates vs the true grades on the target blocks. */
export function rmseOnTargets(model: BlockModel, targets: Int32Array, est: ArrayLike<number>): number {
  if (targets.length === 0) return 0;
  let s = 0;
  for (let t = 0; t < targets.length; t++) {
    const d = (Number(est[t]) || 0) - model.grade[targets[t]];
    s += d * d;
  }
  return Math.sqrt(s / targets.length);
}

/** dims helper for GridDims consumers. */
export function coordsOf(dims: GridDims, i: number): [number, number, number] {
  const iz = Math.floor(i / (dims.nx * dims.ny));
  const iy = Math.floor((i - iz * dims.nx * dims.ny) / dims.nx);
  const ix = i - (iz * dims.ny + iy) * dims.nx;
  return [ix, iy, iz];
}
