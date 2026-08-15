// The canonical case set, shared by the offline bake (data-pipeline/pipeline/science/bake_cases.mjs) and the SPA. Cases
// are grouped by CATEGORY (deposit archetype / economic scenario / slope-geotech / oracle control). The App shows ONE
// selected case; Experiments/Benchmark show cross-case summaries. All deposits are SYNTHETIC (seeded), stated openly;
// CTRL is the closed-form ORACLE (a single deep ore block under a 45° slope → the exact 9-block inverted pyramid).

import { type Archetype, makeDeposit } from './blockmodel.ts';
import { type BlockModel, type EconParams, idx } from './types.ts';

export interface PitCase {
  id: string;
  name: string;
  nameEs: string;
  category: string;
  /** null for the hand-built oracle. */
  archetype: Archetype | null;
  dims: { nx: number; ny: number; nz: number };
  seed: number;
  peakGrade: number;
  econ: EconParams;
  expectedBand: string;
  expectedBandEs: string;
  validationAnchor: string;
  validationAnchorEs: string;
  realOrSynthetic: string;
  realOrSyntheticEs: string;
}

export const CAT_ARCH = 'deposit archetype (the orebody shape)';
export const CAT_ECON = 'economic scenario (the price/cost regime)';
export const CAT_SLOPE = 'slope / geotech (the wall angle)';
export const CAT_ORACLE = 'oracle control (closed-form check)';

// base copper-like economics: $9000/t Cu, 88 % recovery, $2.5/t mined, $9/t milled, 45° walls.
const BASE: EconParams = { price: 9000, recovery: 0.88, miningCost: 2.5, processingCost: 9, slopeAngleDeg: 45 };
const DIMS = { nx: 24, ny: 24, nz: 12 };

export const CASES: PitCase[] = [
  { id: 'A01', name: 'Porphyry copper (disseminated shell)', nameEs: 'Pórfido cuprífero (halo diseminado)', category: CAT_ARCH, archetype: 'porphyry', dims: DIMS,
    seed: 11, peakGrade: 0.025, econ: { ...BASE },
    expectedBand: 'a broad bowl pit centred on the buried ore shell; moderate strip ratio',
    expectedBandEs: 'un rajo amplio, centrado sobre el halo mineralizado enterrado; razón de descapote moderada',
    validationAnchor: 'value identity (ΣpositiveValue − maxflow) + monotone nested shells',
    validationAnchorEs: 'identidad de valor (Σ valores positivos − flujo máximo) + cáscaras anidadas monótonas',
    realOrSynthetic: 'synthetic', realOrSyntheticEs: 'sintético' },
  { id: 'A02', name: 'Tabular vein (dipping)', nameEs: 'Veta tabular (inclinada)', category: CAT_ARCH, archetype: 'vein', dims: DIMS,
    seed: 12, peakGrade: 0.03, econ: { ...BASE },
    expectedBand: 'a narrow, steep-walled pit tracking the inclined vein; high strip',
    expectedBandEs: 'un rajo angosto de paredes empinadas que sigue la veta inclinada; alto descapote',
    validationAnchor: 'precedence cone honoured (no overhang)', validationAnchorEs: 'cono de precedencia respetado (sin voladizos)',
    realOrSynthetic: 'synthetic', realOrSyntheticEs: 'sintético' },
  { id: 'A03', name: 'Layered stratabound', nameEs: 'Estratoligado en capas', category: CAT_ARCH, archetype: 'layered', dims: DIMS,
    seed: 13, peakGrade: 0.022, econ: { ...BASE },
    expectedBand: 'a wide shallow pit stopping at the first uneconomic band',
    expectedBandEs: 'un rajo ancho y somero que se detiene en la primera banda no económica',
    validationAnchor: 'shell nesting', validationAnchorEs: 'anidamiento de cáscaras',
    realOrSynthetic: 'synthetic', realOrSyntheticEs: 'sintético' },
  { id: 'A04', name: 'High-grade core + low-grade halo', nameEs: 'Núcleo de alta ley + halo de baja ley', category: CAT_ARCH, archetype: 'coreHalo', dims: DIMS,
    seed: 14, peakGrade: 0.04, econ: { ...BASE },
    expectedBand: 'a deep central pit; the halo enters only at high revenue factors',
    expectedBandEs: 'un rajo central profundo; el halo entra sólo con factores de ingreso altos',
    validationAnchor: 'RF-driven halo inclusion', validationAnchorEs: 'inclusión del halo gobernada por el factor de ingreso',
    realOrSynthetic: 'synthetic', realOrSyntheticEs: 'sintético' },
  { id: 'E01', name: 'Low price ($5 500/t)', nameEs: 'Precio bajo ($5 500/t)', category: CAT_ECON, archetype: 'porphyry', dims: DIMS,
    seed: 11, peakGrade: 0.025, econ: { ...BASE, price: 5500 },
    expectedBand: 'a markedly smaller pit, only the richest core pays',
    expectedBandEs: 'un rajo marcadamente menor; sólo el núcleo más rico es rentable',
    validationAnchor: 'pit ⊂ the base-price pit', validationAnchorEs: 'rajo ⊂ rajo con precio base',
    realOrSynthetic: 'synthetic', realOrSyntheticEs: 'sintético' },
  { id: 'E02', name: 'High price ($14 000/t)', nameEs: 'Precio alto ($14 000/t)', category: CAT_ECON, archetype: 'porphyry', dims: DIMS,
    seed: 11, peakGrade: 0.025, econ: { ...BASE, price: 14000 },
    expectedBand: 'a larger pit, lower-grade material becomes ore',
    expectedBandEs: 'un rajo mayor; el material de menor ley pasa a ser mineral',
    validationAnchor: 'pit ⊃ the base-price pit', validationAnchorEs: 'rajo ⊃ rajo con precio base',
    realOrSynthetic: 'synthetic', realOrSyntheticEs: 'sintético' },
  { id: 'G01', name: 'Shallow walls (30°)', nameEs: 'Paredes tendidas (30°)', category: CAT_SLOPE, archetype: 'porphyry', dims: DIMS,
    seed: 11, peakGrade: 0.025, econ: { ...BASE, slopeAngleDeg: 30 },
    expectedBand: 'flatter walls, more waste stripping per tonne of ore, lower value than the 45° base',
    expectedBandEs: 'paredes más tendidas, más lastre por tonelada de mineral y menor valor que el caso base de 45°',
    validationAnchor: 'value ≤ the 45° base pit (more stripping)', validationAnchorEs: 'valor ≤ rajo base de 45° (más descapote)',
    realOrSynthetic: 'synthetic', realOrSyntheticEs: 'sintético' },
  { id: 'G02', name: 'Very shallow walls (18°)', nameEs: 'Paredes muy tendidas (18°)', category: CAT_SLOPE, archetype: 'porphyry', dims: DIMS,
    seed: 11, peakGrade: 0.025, econ: { ...BASE, slopeAngleDeg: 18 },
    expectedBand: 'the flattest walls, the widest cone and the most stripping, the lowest value',
    expectedBandEs: 'las paredes más tendidas, el cono más ancho, el mayor descapote y el menor valor',
    validationAnchor: 'value ≤ the 30° pit (even more stripping)', validationAnchorEs: 'valor ≤ rajo de 30° (aún más descapote)',
    realOrSynthetic: 'synthetic', realOrSyntheticEs: 'sintético' },
  { id: 'CTRL', name: 'Oracle, single deep ore block (45°)', nameEs: 'Oráculo, un bloque mineral profundo (45°)', category: CAT_ORACLE, archetype: null,
    dims: { nx: 5, ny: 1, nz: 3 }, seed: 0, peakGrade: 0,
    econ: { price: 11, recovery: 1, miningCost: 1, processingCost: 0, slopeAngleDeg: 45 },
    expectedBand: 'the optimal pit is exactly the 9-block inverted pyramid; value = 10 − 8 = 2',
    expectedBandEs: 'el rajo óptimo es exactamente la pirámide invertida de 9 bloques; valor = 10 − 8 = 2',
    validationAnchor: 'closed-form inverted pyramid (hand-computed)',
    validationAnchorEs: 'pirámide invertida de forma cerrada (calculada a mano)',
    realOrSynthetic: 'analytic control', realOrSyntheticEs: 'control analítico' },
];

export const caseName = (pitCase: PitCase, es: boolean) => es ? pitCase.nameEs : pitCase.name;
export const caseExpectedBand = (pitCase: PitCase, es: boolean) => es ? pitCase.expectedBandEs : pitCase.expectedBand;
export const caseValidationAnchor = (pitCase: PitCase, es: boolean) => es ? pitCase.validationAnchorEs : pitCase.validationAnchor;
export const caseProvenance = (pitCase: PitCase, es: boolean) => es ? pitCase.realOrSyntheticEs : pitCase.realOrSynthetic;
export const caseCategoryName = (pitCase: PitCase, es: boolean) => {
  if (!es) return pitCase.category.split(' (')[0];
  if (pitCase.category === CAT_ARCH) return 'arquetipo de yacimiento';
  if (pitCase.category === CAT_ECON) return 'escenario económico';
  if (pitCase.category === CAT_SLOPE) return 'talud y geotecnia';
  return 'control oráculo';
};

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
