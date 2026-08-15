// Load the committed CONTRACT-2 artifacts (overlaid into public/ by copy-data.mjs). The App runs the optimiser LIVE
// (src/opt) for full reactivity; these baked outputs are the replay fallback + the cross-case data Benchmark/
// Experiments summarise. Paths are relative to the Vite base.
import type { CaseIndex, CaseManifest, CaseResultsFile, CaseTrace } from './contract.types.ts';

const base = () => import.meta.env.BASE_URL || '/';

async function getJSON<T>(rel: string): Promise<T> {
  const r = await fetch(`${base()}${rel}`);
  if (!r.ok) throw new Error(`fetch ${rel} → ${r.status}`);
  return (await r.json()) as T;
}

const record = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
};
const text = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a non-empty string`);
  return value;
};
const number = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return value;
};

/** Runtime Contract-2 parsers. TypeScript types document the shape; these checks enforce untrusted JSON. */
export function parseCaseIndex(value: unknown): CaseIndex {
  const input = record(value, 'case index');
  if (input.schema !== 'pitforge.index/v1') throw new Error(`unsupported index schema ${String(input.schema)}`);
  if (!Array.isArray(input.cases)) throw new Error('case index.cases must be an array');
  const cases = input.cases.map((item, position) => {
    const entry = record(item, `case index.cases[${position}]`);
    return {
      case_id: text(entry.case_id, `case index.cases[${position}].case_id`),
      category: text(entry.category, `case index.cases[${position}].category`),
      manifest_path: text(entry.manifest_path, `case index.cases[${position}].manifest_path`),
    };
  });
  if (number(input.n_cases, 'case index.n_cases') !== cases.length) throw new Error('case index count mismatch');
  if (new Set(cases.map((entry) => entry.case_id)).size !== cases.length) throw new Error('duplicate case id in index');
  return { schema: input.schema, engine_version: text(input.engine_version, 'case index.engine_version'),
    n_cases: cases.length, cases } as CaseIndex;
}

export function parseCaseManifest(value: unknown, expectedCaseId?: string): CaseManifest {
  const input = record(value, 'case manifest');
  if (input.schema !== 'pitforge.manifest/v2') throw new Error(`unsupported manifest schema ${String(input.schema)}`);
  const caseId = text(input.case_id, 'case manifest.case_id');
  if (expectedCaseId && caseId !== expectedCaseId) throw new Error(`manifest identity mismatch for ${expectedCaseId}`);
  const artifact = record(input.artifact, `${caseId}.artifact`);
  const gate = record(input.gate, `${caseId}.gate`);
  text(artifact.path, `${caseId}.artifact.path`);
  number(artifact.bytes, `${caseId}.artifact.bytes`);
  if (artifact.trace_schema !== 'pitforge.trace/v1') throw new Error(`${caseId}: unsupported trace schema`);
  if (input.lane !== gate.lane || !['live', 'precompute'].includes(String(input.lane))) {
    throw new Error(`${caseId}: lane/gate mismatch`);
  }
  number(gate.measured_run_ms, `${caseId}.gate.measured_run_ms`);
  text(gate.measurement_source, `${caseId}.gate.measurement_source`);
  record(input.shared, `${caseId}.shared`);
  return input as unknown as CaseManifest;
}

export function parseCaseTrace(value: unknown, expectedCaseId?: string): CaseTrace {
  const input = record(value, 'case trace');
  if (input.schema !== 'pitforge.trace/v1') throw new Error(`unsupported trace schema ${String(input.schema)}`);
  const caseId = text(input.case_id, 'case trace.case_id');
  if (expectedCaseId && caseId !== expectedCaseId) throw new Error(`trace identity mismatch for ${expectedCaseId}`);
  const ultimate = record(input.ultimate, `${caseId}.ultimate`);
  number(ultimate.pitValue, `${caseId}.ultimate.pitValue`);
  number(ultimate.nBlocks, `${caseId}.ultimate.nBlocks`);
  if (!Array.isArray(input.curve)) throw new Error(`${caseId}.curve must be an array`);
  const learned = record(input.learned, `${caseId}.learned`);
  if (learned.scope !== 'corpus' || learned.source !== 'pit-learned.json') {
    throw new Error(`${caseId}: learned metrics must declare corpus scope`);
  }
  return input as unknown as CaseTrace;
}

export interface ContractCase { index: CaseIndex['cases'][number]; manifest: CaseManifest; trace: CaseTrace }

export async function loadContractCases(): Promise<ContractCase[]> {
  const index = parseCaseIndex(await getJSON<unknown>('data/manifests/index.json'));
  return Promise.all(index.cases.map(async (entry) => {
    if (entry.manifest_path !== `manifests/${entry.case_id}.json`) throw new Error(`${entry.case_id}: unsafe manifest path`);
    const manifest = parseCaseManifest(
      await getJSON<unknown>(`data/${entry.manifest_path}`), entry.case_id,
    );
    if (manifest.artifact.path !== `${entry.case_id}/trace.json`) throw new Error(`${entry.case_id}: unsafe trace path`);
    const trace = parseCaseTrace(await getJSON<unknown>(`data/${manifest.artifact.path}`), entry.case_id);
    return { index: entry, manifest, trace };
  }));
}

export interface LearnedFile {
  schema: string;
  gradeNN: { r2_vs_holdout: number; r2_idw: number; r2_ok: number; nTrain: number; nEval: number;
    split: string; evalGroup: string };
  pitSurrogate: { auc: number; acc: number; baseline_auc: number; baseline_acc: number; nTrain: number; nEval: number;
    split: string; evalGroup: string };
  honesty: string;
}

export interface MinelibBenchFile {
  schema: string;
  bakedAt: string;
  engine: string;
  license: string;
  results: {
    id: string; name: string; nBlocks: number; nPrecs: number;
      publishedOptimum: number; ourValue: number; relError: number; match: boolean;
      nInPit: number; parseMs: number; dinicMsMedian: number; pseudoflowMsMedian: number;
      solverValueDifference: number; blockSetDifference: number; solverAgreement: boolean;
      pseudoflowStats: { mergers: number; pushes: number; splits: number; arcScans: number };
  }[];
  excluded: { id: string; nBlocks: number; publishedOptimum: number | null; reason: string }[];
}

export interface CpitPeriod {
  period: number;
  minedTonnes: number;
  npvIncrement: number;
  cumulativeNpv: number;
  resourceUsage: number[];
}

export interface CpitScenario {
  kind: 'pitforge-authored' | 'minelib-published';
  label: string;
  comparableToPublishedMineLibCpit: boolean;
}

export interface CpitPublishedComparison {
  mineLibLpUpperBoundNpv: number;
  mineLibPublishedFeasibleNpv: number;
  mineLibPublishedGapPct: number;
  ourBoundRelativeError: number;
  ourBoundMatchesPublished: boolean;
  ourHeuristicMinusPublishedFeasibleNpv: number;
  ourHeuristicRelativeToPublishedFeasiblePct: number;
}

export type CpitProvenance = {
  kind: 'minelib';
  citationDoi: string;
  license: string;
  licenseUrl: string;
  scenarioUrl: string;
  repositoryPolicy: string;
} | {
  kind: 'synthetic-twin';
  generator: string;
  generatorVersion: string;
  generatorRepository: string;
  license: string;
};

export interface CpitCase {
  source: string;
  nBlocks: number;
  nPrecs: number;
  uplValue: number;
  uplBlocks: number;
  uplTonnage: number;
  periods: number;
  discountRatePerPeriod: number;
  /** Certified upper bound from the cumulative Chicoisne LP solved through SciPy/HiGHS. */
  certifiedBoundNpv: number;
  /** Feasible integer schedule NPV from the independent greedy heuristic. */
  feasibleHeuristicNpv: number;
  /** (LP upper bound - feasible heuristic) / LP upper bound; the integer optimum is unknown. */
  boundToFeasibleGapPct: number;
  minedBlocks: number;
  controls: {
    dualityMatch: boolean;
    dualityBoundVsUpl: number;
    boundGeqFeasible: boolean;
    resourceLimitsRespected: boolean;
    precedenceRespected: boolean;
    completeUltimatePit: boolean;
  };
  perPeriod: CpitPeriod[];
  scenario: CpitScenario;
  provenance: CpitProvenance;
  resourceConstraints: { id: number; label: string; limits: number[] }[];
  publishedComparison?: CpitPublishedComparison;
  /** Committed only for the MIT-licensed synthetic twin (per-block period index, -1 = never mined). */
  periodOfBlock?: number[];
}

export interface CpitScheduleFile {
  schema: string;
  generatedAt: string;
  engine: string;
  honesty: string;
  parameters: {
    syntheticTwinScenario: { periods: number; discountRatePerPeriod: number; capacitySlack: number };
  };
  cases: Record<string, CpitCase>;
}

export const loadCaseResults = () => getJSON<CaseResultsFile>('case-results.json');
export const loadLearned = () => getJSON<LearnedFile>('pit-learned.json');
export const loadMinelibBench = () => getJSON<MinelibBenchFile>('minelib-results.json');
export const loadCpitSchedule = () => getJSON<CpitScheduleFile>('cpit-schedule.json');
export const loadIndex = async () => parseCaseIndex(await getJSON<unknown>('data/manifests/index.json'));
export const loadManifest = async (caseId: string) => parseCaseManifest(
  await getJSON<unknown>(`data/manifests/${caseId}.json`), caseId,
);
export const loadTrace = async (caseId: string) => parseCaseTrace(
  await getJSON<unknown>(`data/${caseId}/trace.json`), caseId,
);
