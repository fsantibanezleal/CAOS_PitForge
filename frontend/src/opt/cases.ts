// The canonical case set — shared by the offline bake (data-pipeline/pflab/science/bake_cases.mjs) and the SPA. Cases
// are grouped by CATEGORY (deposit archetype / economic scenario / slope-geotech / oracle control). The App shows ONE
// selected case; Experiments/Benchmark show cross-case summaries. All deposits are SYNTHETIC (seeded), stated openly;
// CTRL is the closed-form ORACLE (a single deep ore block under a 45° slope → the exact 9-block inverted pyramid).

import { type Archetype, makeDeposit } from './blockmodel.ts';
import { type BlockModel, type EconParams, idx } from './types.ts';

export interface PitCase {
  id: string;
  name: string;
  category: string;
  /** null for the hand-built oracle. */
  archetype: Archetype | null;
  dims: { nx: number; ny: number; nz: number };
  seed: number;
  peakGrade: number;
  econ: EconParams;
  expectedBand: string;
  validationAnchor: string;
  realOrSynthetic: string;
}

export const CAT_ARCH = 'deposit archetype (the orebody shape)';
export const CAT_ECON = 'economic scenario (the price/cost regime)';
export const CAT_SLOPE = 'slope / geotech (the wall angle)';
export const CAT_ORACLE = 'oracle control (closed-form check)';

// base copper-like economics: $9000/t Cu, 88 % recovery, $2.5/t mined, $9/t milled, 45° walls.
const BASE: EconParams = { price: 9000, recovery: 0.88, miningCost: 2.5, processingCost: 9, slopeAngleDeg: 45 };
const DIMS = { nx: 24, ny: 24, nz: 12 };

export const CASES: PitCase[] = [
  { id: 'A01', name: 'Porphyry copper (disseminated shell)', category: CAT_ARCH, archetype: 'porphyry', dims: DIMS,
    seed: 11, peakGrade: 0.025, econ: { ...BASE },
    expectedBand: 'a broad bowl pit centred on the buried ore shell; moderate strip ratio',
    validationAnchor: 'value identity (ΣpositiveValue − maxflow) + monotone nested shells', realOrSynthetic: 'synthetic' },
  { id: 'A02', name: 'Tabular vein (dipping)', category: CAT_ARCH, archetype: 'vein', dims: DIMS,
    seed: 12, peakGrade: 0.03, econ: { ...BASE },
    expectedBand: 'a narrow, steep-walled pit tracking the inclined vein; high strip',
    validationAnchor: 'precedence cone honoured (no overhang)', realOrSynthetic: 'synthetic' },
  { id: 'A03', name: 'Layered stratabound', category: CAT_ARCH, archetype: 'layered', dims: DIMS,
    seed: 13, peakGrade: 0.022, econ: { ...BASE },
    expectedBand: 'a wide shallow pit stopping at the first uneconomic band', validationAnchor: 'shell nesting',
    realOrSynthetic: 'synthetic' },
  { id: 'A04', name: 'High-grade core + low-grade halo', category: CAT_ARCH, archetype: 'coreHalo', dims: DIMS,
    seed: 14, peakGrade: 0.04, econ: { ...BASE },
    expectedBand: 'a deep central pit; the halo enters only at high revenue factors',
    validationAnchor: 'RF-driven halo inclusion', realOrSynthetic: 'synthetic' },
  { id: 'E01', name: 'Low price ($5 500/t)', category: CAT_ECON, archetype: 'porphyry', dims: DIMS,
    seed: 11, peakGrade: 0.025, econ: { ...BASE, price: 5500 },
    expectedBand: 'a markedly smaller pit — only the richest core pays', validationAnchor: 'pit ⊂ the base-price pit',
    realOrSynthetic: 'synthetic' },
  { id: 'E02', name: 'High price ($14 000/t)', category: CAT_ECON, archetype: 'porphyry', dims: DIMS,
    seed: 11, peakGrade: 0.025, econ: { ...BASE, price: 14000 },
    expectedBand: 'a larger pit — lower-grade material becomes ore', validationAnchor: 'pit ⊃ the base-price pit',
    realOrSynthetic: 'synthetic' },
  { id: 'G01', name: 'Shallow walls (30°)', category: CAT_SLOPE, archetype: 'porphyry', dims: DIMS,
    seed: 11, peakGrade: 0.025, econ: { ...BASE, slopeAngleDeg: 30 },
    expectedBand: 'flatter walls → more waste stripping per tonne of ore → lower value than the 45° base',
    validationAnchor: 'value ≤ the 45° base pit (more stripping)', realOrSynthetic: 'synthetic' },
  { id: 'G02', name: 'Very shallow walls (18°)', category: CAT_SLOPE, archetype: 'porphyry', dims: DIMS,
    seed: 11, peakGrade: 0.025, econ: { ...BASE, slopeAngleDeg: 18 },
    expectedBand: 'the flattest walls → the widest cone and the most stripping → the lowest value',
    validationAnchor: 'value ≤ the 30° pit (even more stripping)', realOrSynthetic: 'synthetic' },
  { id: 'CTRL', name: 'Oracle — single deep ore block (45°)', category: CAT_ORACLE, archetype: null,
    dims: { nx: 5, ny: 1, nz: 3 }, seed: 0, peakGrade: 0,
    econ: { price: 11, recovery: 1, miningCost: 1, processingCost: 0, slopeAngleDeg: 45 },
    expectedBand: 'the optimal pit is EXACTLY the 9-block inverted pyramid; value = 10 − 8 = 2',
    validationAnchor: 'closed-form inverted pyramid (hand-computed)', realOrSynthetic: 'analytic control' },
];

/** Build the block model for a case (the oracle is hand-built; the rest are seeded deposits). */
export function caseModel(c: PitCase): BlockModel {
  if (c.archetype === null) {
    // the oracle: a 5×1×3 slice, all waste except one deep ore block at (2,0,2) with grade 1 (value 11·1−1 = 10).
    const dims = c.dims;
    const N = dims.nx * dims.ny * dims.nz;
    const grade = new Float64Array(N);
    grade[idx(dims, 2, 0, 2)] = 1;
    return {
      dims, block: { dx: 10, dy: 10, dz: 10 },
      tonnage: new Float64Array(N).fill(1), density: new Float64Array(N).fill(2.7), grade,
      meta: { name: c.name, archetype: 'oracle', gradeUnit: 'mass fraction' },
    };
  }
  return makeDeposit({ archetype: c.archetype, dims: c.dims, seed: c.seed, peakGrade: c.peakGrade, name: c.name });
}
