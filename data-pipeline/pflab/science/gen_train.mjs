// Generate the learned-model training tables by running the SAME TypeScript engine the browser runs — so the learned
// models are trained on EXACTLY the deposits + the EXACT-solver labels the App shows. Writes to data/raw/ (git-ignored,
// regenerable). Invoked by pipeline.retrain before train_pit.py. Run:
//   node --import tsx data-pipeline/pflab/science/gen_train.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASES, caseModel } from '../../../frontend/src/opt/cases.ts';
import { blockValue, solveUltimatePit } from '../../../frontend/src/opt/index.ts';
import { idx } from '../../../frontend/src/opt/types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = resolve(HERE, '../../../data/raw');
mkdirSync(RAW, { recursive: true });

// ---- pit-surrogate: per-block features + the EXACT in-pit label, across the economic/slope cases ----------
// features: [depth_frac, block_value (raw), neighbourhood_value (raw), radial_frac]; label = in the exact pit.
const pitF = [];
const pitY = [];
for (const c of CASES) {
  if (c.archetype === null) continue;                       // skip the tiny oracle
  const model = caseModel(c);
  const { nx, ny, nz } = model.dims;
  const econ = { ...c.econ, revenueFactor: 1 };
  const pit = solveUltimatePit(model, econ);
  const val = new Float64Array(nx * ny * nz);
  for (let i = 0; i < val.length; i++) val[i] = blockValue(model, i, econ);
  const cx = (nx - 1) / 2;
  const cy = (ny - 1) / 2;
  const maxR = Math.hypot(cx, cy) || 1;
  for (let iz = 0; iz < nz; iz++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        const i = idx(model.dims, ix, iy, iz);
        let nsum = 0;
        let ncnt = 0;
        for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy && !dz) continue;
          const jx = ix + dx, jy = iy + dy, jz = iz + dz;
          if (jx < 0 || jx >= nx || jy < 0 || jy >= ny || jz < 0 || jz >= nz) continue;
          nsum += val[idx(model.dims, jx, jy, jz)];
          ncnt++;
        }
        pitF.push([iz / Math.max(1, nz - 1), val[i], ncnt ? nsum / ncnt : 0, Math.hypot(ix - cx, iy - cy) / maxR]);
        pitY.push(pit.inPit[i]);
      }
    }
  }
}

// ---- grade-nn: a masked 3×3×3 grade stencil → the centre grade, across the 4 distinct geologies ----------
// Each sampled centre contributes TWO rows: the full 26-neighbour stencil AND a sparse variant
// with random neighbour dropout (keep-prob ~ U(0.1, 0.9), seeded). The sparse rows put the
// drilling-density what-if (App Infill tool) IN distribution — without them the model only ever
// sees complete neighbourhoods and collapses on partially-drilled stencils.
const gX = [];
const gY = [];
let rngState = 0xC0FFEE;
const rand = () => {
  rngState |= 0; rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const seenModel = new Set();
for (const c of CASES) {
  if (c.archetype === null) continue;
  const key = `${c.archetype}:${c.seed}:${c.peakGrade}`;
  if (seenModel.has(key)) continue;                          // one geology each (econ/slope variants reuse the model)
  seenModel.add(key);
  const model = caseModel(c);
  const { nx, ny, nz } = model.dims;
  let k = 0;
  for (let iz = 0; iz < nz; iz++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        if (k++ % 2 !== 0) continue;                          // stride 2 → ~half, keeps the table light
        const stencil = [];
        for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const center = !dx && !dy && !dz;
          const jx = ix + dx, jy = iy + dy, jz = iz + dz;
          const inb = jx >= 0 && jx < nx && jy >= 0 && jy < ny && jz >= 0 && jz < nz;
          stencil.push(center || !inb ? 0 : model.grade[idx(model.dims, jx, jy, jz)]);   // centre masked
        }
        const y = model.grade[idx(model.dims, ix, iy, iz)];
        gX.push(stencil);
        gY.push(y);
        const keep = 0.1 + 0.8 * rand();                      // sparse variant (drilling-density dropout)
        gX.push(stencil.map((v) => (rand() < keep ? v : 0)));
        gY.push(y);
      }
    }
  }
}

writeFileSync(resolve(RAW, 'pit-train.json'), JSON.stringify({ f: pitF, y: pitY }));
writeFileSync(resolve(RAW, 'grade-train.json'), JSON.stringify({ x: gX, y: gY }));
console.log(`gen_train: pit-surrogate ${pitY.length} rows · grade-nn ${gY.length} rows -> ${RAW}`);
