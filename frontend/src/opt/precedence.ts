// Slope-precedence template, which blocks must be removed ABOVE a block before it can be mined.
//
// A pit wall stands at the overall slope angle θ (from horizontal). To mine a block, every block within the inverted
// cone above it (the cone whose wall is at θ) must already be gone. On a regular grid we encode this with arcs to the
// blocks one bench ABOVE (z−1): for a vertical step dz, the wall may move horizontally by dz/tan(θ). Converted to
// block counts that is rx = round(dz/(dx·tanθ)), ry = round(dz/(dy·tanθ)). Adding arcs only to the (2rx+1)×(2ry+1)
// box at z−1 and letting TRANSITIVITY climb the levels reproduces the full cone exactly, the standard reduced
// precedence pattern (e.g. θ≈45° with cubic blocks gives rx=ry=1, the classic 9-point template).
//
// Returns, for each block, the list of overlying blocks it depends on at the immediately-higher bench.

import { type BlockModel, type GridDims, idx } from './types.ts';

export interface PrecedenceTemplate {
  /** horizontal half-width of the 1-bench cone, in blocks. */
  rx: number;
  ry: number;
  /** (dix, diy) offsets at z−1 for one block. */
  offsets: Array<[number, number]>;
}

export function slopeTemplate(model: BlockModel, slopeAngleDeg: number): PrecedenceTemplate {
  const theta = (slopeAngleDeg * Math.PI) / 180;
  const t = Math.tan(theta);
  // a near-vertical wall (θ→90°) still needs the directly-overlying block; clamp to ≥1 so the cone is never empty.
  const rx = Math.max(1, Math.round(model.block.dz / (model.block.dx * t)));
  const ry = Math.max(1, Math.round(model.block.dz / (model.block.dy * t)));
  const offsets: Array<[number, number]> = [];
  for (let di = -rx; di <= rx; di++) {
    for (let dj = -ry; dj <= ry; dj++) offsets.push([di, dj]);
  }
  return { rx, ry, offsets };
}

/**
 * Iterate the precedence arcs (i → j) for the whole model: block i at (ix,iy,iz) depends on each in-bounds block j in
 * its slope template at bench iz−1. `emit(i, j)` is called once per arc.
 */
export function forEachPrecedenceArc(
  model: BlockModel,
  tmpl: PrecedenceTemplate,
  emit: (i: number, j: number) => void,
): void {
  const d: GridDims = model.dims;
  for (let iz = 1; iz < d.nz; iz++) {
    for (let iy = 0; iy < d.ny; iy++) {
      for (let ix = 0; ix < d.nx; ix++) {
        const i = idx(d, ix, iy, iz);
        for (const [di, dj] of tmpl.offsets) {
          const jx = ix + di;
          const jy = iy + dj;
          if (jx < 0 || jx >= d.nx || jy < 0 || jy >= d.ny) continue;
          emit(i, idx(d, jx, jy, iz - 1));
        }
      }
    }
  }
}
