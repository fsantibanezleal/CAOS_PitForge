// Bake the per-case ultimate pit + Whittle nested shells through the SAME TypeScript engine the browser runs, and
// write data/derived/case-results.json — the committed, deterministic per-case outputs the LIGHT Python pipeline
// reshapes into per-case replay traces + manifests (CONTRACT 2). No Python re-port of the optimiser — the lesson from
// the sibling products (ChancaDEM / DispatchLab). Run after the SPA lives under frontend/:
//   node --import tsx data-pipeline/pflab/science/bake_cases.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASES, caseModel } from '../../../frontend/src/opt/cases.ts';
import { defaultRevenueFactors, nestedPitShells, solveUltimatePit } from '../../../frontend/src/opt/index.ts';
import { idx } from '../../../frontend/src/opt/types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DERIVED = resolve(HERE, '../../../data/derived');
mkdirSync(DERIVED, { recursive: true });

const RFS = defaultRevenueFactors(12);
const r0 = (x) => Math.round(x);
const r1 = (x) => Math.round(x * 10) / 10;
const r3 = (x) => Math.round(x * 1000) / 1000;

function summary(pit) {
  return {
    pitValue: r0(pit.pitValue),
    oreTonnes: r0(pit.oreTonnes),
    wasteTonnes: r0(pit.wasteTonnes),
    metalTonnes: r1(pit.metalTonnes),
    stripRatio: r3(pit.stripRatio),
    nBlocks: pit.nBlocks,
  };
}

function gradeStats(model) {
  const g = model.grade;
  let mn = Infinity;
  let mx = -Infinity;
  let s = 0;
  for (let i = 0; i < g.length; i++) {
    if (g[i] < mn) mn = g[i];
    if (g[i] > mx) mx = g[i];
    s += g[i];
  }
  return { min: r3(mn), max: r3(mx), mean: r3(s / g.length) };
}

const cases = {};
for (const c of CASES) {
  const model = caseModel(c);
  const ultimate = solveUltimatePit(model, { ...c.econ, revenueFactor: 1 });
  const shells = nestedPitShells(model, c.econ, RFS);
  // a vertical cross-section through the pit centre: shell index per (ix, iz) at the mid row — instant 2-D preview.
  const iy = Math.floor(model.dims.ny / 2);
  const section = [];
  for (let iz = 0; iz < model.dims.nz; iz++) {
    const row = [];
    for (let ix = 0; ix < model.dims.nx; ix++) row.push(shells.shellOf[idx(model.dims, ix, iy, iz)]);
    section.push(row);
  }
  cases[c.id] = {
    name: c.name,
    category: c.category,
    archetype: c.archetype,
    seed: c.seed,
    dims: model.dims,
    block: model.block,
    econ: c.econ,
    realOrSynthetic: c.realOrSynthetic,
    expectedBand: c.expectedBand,
    validationAnchor: c.validationAnchor,
    ultimate: summary(ultimate),
    curve: shells.curve.map((p) => ({
      rf: p.rf, pitValue: r0(p.pitValue), oreTonnes: r0(p.oreTonnes), wasteTonnes: r0(p.wasteTonnes),
      metalTonnes: r1(p.metalTonnes), stripRatio: r3(p.stripRatio), nBlocks: p.nBlocks,
    })),
    section: { iy, nx: model.dims.nx, nz: model.dims.nz, shellOf: section },
    gradeStats: gradeStats(model),
  };
}

const out = { schema: 'pitforge.case-results/v1', rfSchedule: RFS, nCases: CASES.length, cases };
writeFileSync(resolve(DERIVED, 'case-results.json'), JSON.stringify(out), 'utf-8');
console.log(`baked ${CASES.length} cases -> ${resolve(DERIVED, 'case-results.json')}`);
