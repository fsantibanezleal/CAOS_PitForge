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

export interface LearnedFile {
  schema: string;
  gradeNN: { r2_vs_holdout: number; r2_idw: number; r2_ok: number; nTrain: number; nEval: number };
  pitSurrogate: { auc: number; acc: number; baseline: number; nTrain: number; nEval: number };
  honesty: string;
}

export const loadCaseResults = () => getJSON<CaseResultsFile>('case-results.json');
export const loadLearned = () => getJSON<LearnedFile>('pit-learned.json');
export const loadIndex = () => getJSON<CaseIndex>('data/manifests/index.json');
export const loadManifest = (caseId: string) => getJSON<CaseManifest>(`data/manifests/${caseId}.json`);
export const loadTrace = (caseId: string) => getJSON<CaseTrace>(`data/${caseId}/trace.json`);
