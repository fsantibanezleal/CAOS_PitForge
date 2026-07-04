// Synthetic deposit generators, geostatistically plausible block models for the canonical cases.
//
// These are clearly SYNTHETIC (no real drillholes), but they are built the way real deposits are described: a
// deterministic grade trend (the geological "shape") plus spatially-correlated noise (a smoothed white field that
// mimics a variogram range), so the optimiser has to make non-trivial ore/waste and slope trade-offs. Everything is
// seeded → byte-identical given (archetype, dims, seed).

import { type BlockModel, type BlockSize, type GridDims, idx } from './types.ts';

export type Archetype = 'porphyry' | 'vein' | 'layered' | 'coreHalo';

/** mulberry32, a tiny, fast, seedable PRNG (deterministic across Node and the browser). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A few in-place box-blur passes give the white field a spatial correlation length (a cheap variogram range). */
function smooth(field: Float64Array, d: GridDims, passes: number): void {
  const tmp = new Float64Array(field.length);
  for (let p = 0; p < passes; p++) {
    for (let iz = 0; iz < d.nz; iz++) {
      for (let iy = 0; iy < d.ny; iy++) {
        for (let ix = 0; ix < d.nx; ix++) {
          let sum = 0;
          let cnt = 0;
          for (let dz = -1; dz <= 1; dz++) {
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const jx = ix + dx;
                const jy = iy + dy;
                const jz = iz + dz;
                if (jx < 0 || jx >= d.nx || jy < 0 || jy >= d.ny || jz < 0 || jz >= d.nz) continue;
                sum += field[idx(d, jx, jy, jz)];
                cnt++;
              }
            }
          }
          tmp[idx(d, ix, iy, iz)] = sum / cnt;
        }
      }
    }
    field.set(tmp);
  }
}

function trend(arch: Archetype, fx: number, fy: number, fz: number): number {
  // fx,fy,fz ∈ [0,1] normalised grid coordinates; returns a relative grade shape in ~[0,1].
  const cx = fx - 0.5;
  const cy = fy - 0.5;
  switch (arch) {
    case 'porphyry': {
      // a buried ellipsoidal shell: high on a sphere a little below surface, fading in/out.
      const r = Math.sqrt(cx * cx + cy * cy + (fz - 0.45) * (fz - 0.45));
      return Math.max(0, 1 - Math.abs(r - 0.22) / 0.28);
    }
    case 'vein': {
      // a dipping tabular zone: high where the point is near an inclined plane.
      const plane = cx * 0.8 + (fz - 0.5) * 0.6;
      return Math.max(0, 1 - Math.abs(plane) / 0.12);
    }
    case 'layered': {
      // horizontal stratabound bands.
      return 0.5 + 0.5 * Math.cos(fz * Math.PI * 4);
    }
    case 'coreHalo': {
      // a rich central core inside a broad low-grade halo.
      const r = Math.sqrt(cx * cx + cy * cy + (fz - 0.5) * (fz - 0.5));
      return Math.max(0, 1 - r / 0.45) ** 1.6;
    }
  }
}

export interface DepositSpec {
  archetype: Archetype;
  dims: GridDims;
  block?: BlockSize;
  seed?: number;
  /** peak grade as a mass fraction (e.g. 0.02 = 2 %). */
  peakGrade?: number;
  /** background grade fraction. */
  background?: number;
  /** in-situ density (t/m³). */
  density?: number;
  /** relative noise amplitude (0..1). */
  noise?: number;
  name?: string;
}

export function makeDeposit(spec: DepositSpec): BlockModel {
  const d = spec.dims;
  const block: BlockSize = spec.block ?? { dx: 10, dy: 10, dz: 10 };
  const seed = spec.seed ?? 1;
  const peak = spec.peakGrade ?? 0.02;
  const bg = spec.background ?? 0.001;
  const density = spec.density ?? 2.7;
  const noiseAmp = spec.noise ?? 0.35;
  const N = d.nx * d.ny * d.nz;

  const rnd = mulberry32(seed);
  const noise = new Float64Array(N);
  for (let i = 0; i < N; i++) noise[i] = rnd() - 0.5;
  smooth(noise, d, 3);

  const grade = new Float64Array(N);
  const tonnage = new Float64Array(N);
  const dens = new Float64Array(N);
  const blockTonnes = block.dx * block.dy * block.dz * density;
  for (let iz = 0; iz < d.nz; iz++) {
    for (let iy = 0; iy < d.ny; iy++) {
      for (let ix = 0; ix < d.nx; ix++) {
        const i = idx(d, ix, iy, iz);
        const fx = d.nx > 1 ? ix / (d.nx - 1) : 0.5;
        const fy = d.ny > 1 ? iy / (d.ny - 1) : 0.5;
        const fz = d.nz > 1 ? iz / (d.nz - 1) : 0.5;
        const shape = trend(spec.archetype, fx, fy, fz);
        const g = bg + (peak - bg) * Math.max(0, shape + noiseAmp * noise[i]);
        grade[i] = Math.max(0, g);
        dens[i] = density;
        tonnage[i] = blockTonnes;
      }
    }
  }

  return {
    dims: d,
    block,
    tonnage,
    density: dens,
    grade,
    meta: { name: spec.name ?? spec.archetype, archetype: spec.archetype, gradeUnit: 'mass fraction' },
  };
}
