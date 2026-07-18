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

// ---------------------------------------------------------------------------------------------------------------
// VARIABLE (geomechanical) slope, KhaloKakaie, Dowd & Fowell (2000), "Lerchs-Grossmann algorithm with variable
// slope angles", Mining Technology 109(2), 77-85, doi:10.1179/mnt.2000.109.2.77. Slope angles are defined in the
// four principal directions (N/E/S/W) and the cone wall between them follows an ELLIPTIC interpolation: within a
// quadrant the allowed horizontal reach at azimuth phi is the polar radius of the ellipse whose semi-axes are the
// reaches of the two adjacent principal directions, r(phi) = rA*rB / sqrt((rB cos phi)^2 + (rA sin phi)^2).
// A shallower wall angle means a FLATTER wall and therefore a LARGER reach (more overlying blocks to strip).
// Because arcs still go only to the bench immediately above and transitivity composes the cone level by level,
// any per-bench template of this form remains a valid CLOSURE, so the min-cut solve stays EXACT.

export interface SlopeAngles {
  /** wall angle [deg from horizontal] toward each principal compass direction; +y = north, +x = east. */
  north: number; east: number; south: number; west: number;
}

/** One-bench offsets for the azimuth-dependent cone (KDF elliptic interpolation between N/E/S/W reaches).
 *  Radii are ROUNDED to block units per principal direction (the same convention as the isotropic template), and
 *  the quadrant ellipse runs in block units, so e.g. west=30 deg with 10 m cubes reaches 2 blocks west.
 *  DISCRETIZATION NOTE, stated honestly: at 45 deg on cubic blocks this yields the classic 5-point PLUS cone
 *  (corners excluded, a CIRCULAR cone), while the isotropic box template is the 9-point SQUARE cone whose
 *  diagonals are effectively shallower (~35 deg). Both are standard patterns (the 1-5 vs 1-9 family); the
 *  elliptic form is the more faithful wall and is what the variable-slope literature interpolates. */
export function slopeTemplateVariable(model: BlockModel, angles: SlopeAngles): PrecedenceTemplate {
  const { dx, dy, dz } = model.block;
  const reachBlocks = (deg: number, cell: number) => Math.max(1, Math.round(dz / (cell * Math.tan((deg * Math.PI) / 180))));
  const rN = reachBlocks(angles.north, dy), rS = reachBlocks(angles.south, dy);
  const rE = reachBlocks(angles.east, dx), rW = reachBlocks(angles.west, dx);
  const rx = Math.max(rE, rW);
  const ry = Math.max(rN, rS);
  const offsets: Array<[number, number]> = [];
  for (let di = -rx; di <= rx; di++) {
    for (let dj = -ry; dj <= ry; dj++) {
      if (di === 0 && dj === 0) { offsets.push([di, dj]); continue; }   // the direct overlying block, always
      const rEW = di >= 0 ? rE : rW;                                     // the quadrant's principal radii [blocks]
      const rNS = dj >= 0 ? rN : rS;
      // inside the quadrant ellipse (block units): (di/rEW)^2 + (dj/rNS)^2 <= 1
      if ((di * di) / (rEW * rEW) + (dj * dj) / (rNS * rNS) <= 1 + 1e-9) offsets.push([di, dj]);
    }
  }
  return { rx, ry, offsets };
}

/** Per-rock-domain variable slope: iterate the arcs with a PER-BLOCK template (the block's geotechnical domain
 *  picks its angle set, e.g. from BancoEstable's allowable-angle-per-domain export). The relation still only
 *  points one bench up, so it composes to a valid closure and the min-cut stays exact for that relation. */
export function forEachPrecedenceArcVariable(
  model: BlockModel,
  templateFor: (blockIndex: number) => PrecedenceTemplate,
  emit: (i: number, j: number) => void,
): void {
  const d: GridDims = model.dims;
  for (let iz = 1; iz < d.nz; iz++) {
    for (let iy = 0; iy < d.ny; iy++) {
      for (let ix = 0; ix < d.nx; ix++) {
        const i = idx(d, ix, iy, iz);
        const tmpl = templateFor(i);
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
