// Contract 2 mirror (frontend side). Must stay in lock-step with the Python schemas in
// data-pipeline/pflab/core/{trace.py, manifest.py}. A drift here makes `tsc` fail -> the contract is enforced at
// build time (the web cannot ship reading a shape the pipeline does not produce).

// ---------- per-case replay trace (pitforge.trace/v1) ----------

export interface WhittlePoint {
  rf: number;
  pitValue: number;
  oreTonnes: number;
  wasteTonnes: number;
  metalTonnes: number;
  stripRatio: number;
  nBlocks: number;
}

export interface PitSummary {
  pitValue: number;
  oreTonnes: number;
  wasteTonnes: number;
  metalTonnes: number;
  stripRatio: number;
  nBlocks: number;
}

export interface CaseSection {
  iy: number;
  nx: number;
  nz: number;
  /** shell index per (iz, ix) on the cross-section; -1 = never in any pit. */
  shellOf: number[][];
}

export interface CaseSpec {
  archetype: string | null;
  seed: number;
  dims: { nx: number; ny: number; nz: number };
  block: { dx: number; dy: number; dz: number };
  econ: {
    price: number;
    recovery: number;
    miningCost: number;
    processingCost: number;
    slopeAngleDeg: number;
    revenueFactor?: number;
  };
}

export interface LearnedMetrics {
  status: 'trained' | 'pending-training';
  gradeNN: { r2_vs_holdout: number; r2_idw: number; r2_ok: number; nTrain: number; nEval: number } | null;
  pitSurrogate: { auc: number; acc: number; baseline: number; nTrain: number; nEval: number } | null;
}

export interface CaseTrace {
  schema: string; // "pitforge.trace/v1"
  case_id: string;
  name: string;
  category: string;
  real_or_synthetic: string;
  expected_band: string;
  spec: CaseSpec;
  ultimate: PitSummary;
  curve: WhittlePoint[];
  section: CaseSection;
  grade_stats: { min: number; max: number; mean: number };
  learned: LearnedMetrics;
}

// ---------- manifest (pitforge.manifest/v2) + index ----------

export interface ArtifactRef { path: string; format: string; trace_schema: string; bytes: number; }

export interface GateVerdict {
  lane: string;
  client_side: boolean;
  runtimes: string[];
  trace_bytes: number;
  run_ms_budget: number;
  trace_bytes_budget: number;
  reasons: string[];
}

export interface SharedArtifacts {
  models: Array<{ id: string; file: string; opset: number; kind: string }>;
  learned_metrics: string;
  case_results: string;
}

export interface CaseManifest {
  schema: string; // "pitforge.manifest/v2"
  case_id: string;
  name: string;
  category: string;
  real_or_synthetic: string;
  expected_band: string;
  validation_anchor: string;
  engine: { package: string; version: string; model: string };
  seed: number;
  shared: SharedArtifacts;
  artifact: ArtifactRef;
  lane: 'live' | 'precompute';
  gate: GateVerdict;
  flags: Array<Record<string, unknown>>;
  metrics: Record<string, number>;
  honesty: string;
}

export interface CaseIndexEntry { case_id: string; category: string; manifest_path: string; }

export interface CaseIndex {
  schema: string; // "pitforge.index/v1"
  engine_version: string;
  n_cases: number;
  cases: CaseIndexEntry[];
}

// ---------- the baked case-results.json (pitforge.case-results/v1) consumed by the bake + the App ----------

export interface CaseResult {
  name: string;
  category: string;
  archetype: string | null;
  seed: number;
  dims: { nx: number; ny: number; nz: number };
  block: { dx: number; dy: number; dz: number };
  econ: CaseSpec['econ'];
  realOrSynthetic: string;
  expectedBand: string;
  validationAnchor: string;
  ultimate: PitSummary;
  curve: WhittlePoint[];
  section: CaseSection;
  gradeStats: { min: number; max: number; mean: number };
}

export interface CaseResultsFile {
  schema: string; // "pitforge.case-results/v1"
  rfSchedule: number[];
  nCases: number;
  cases: Record<string, CaseResult>;
}
