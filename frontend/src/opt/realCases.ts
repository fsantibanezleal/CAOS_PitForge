// The REAL block-model registry — MineLib benchmark instances (Espinoza, Goycoolea, Moreno &
// Newman 2013, Annals of OR 206:93–114, doi:10.1007/s10479-012-1258-3).
//
// LICENSE POSTURE (issue #11 re-analysis). MineLib's only grant is "these files may be downloaded
// for academic purposes" — there is NO redistribution permission (datasets come from anonymous
// industrial donors; marvin ships with the commercial Whittle software). Therefore instance files
// are NEVER committed to this repo and never bundled into the SPA. The app fetches them at
// runtime into browser memory only; the offline bake (#17) uses a gitignored local cache. Only
// SUMMARY facts live here (block/arc counts and the published UPIT optima are already public).
//
// This module is the boundary between the UI and the real-data lane: the registry + the solve
// entry point. The fetch/parse/solve implementation lands with the parsers milestone (#13).

export interface RealCase {
  id: string;
  name: string;
  /** block / precedence-arc counts, from the MineLib paper (public facts). */
  nBlocks: number;
  nPrecs: number;
  /** the published UPIT optimum — the oracle the exact solver must reproduce. */
  publishedOptimum: number;
  /** live: solve on select · size-gated: solve only on explicit confirm · offline-only: bake lane (#17). */
  gate: 'live' | 'size-gated' | 'offline-only';
  /** plain-HTTPS runtime-fetch endpoints, or null when only an archive source exists (resolved in #13). */
  urls: { blocks: string; prec: string; upit: string } | null;
  provenance_en: string;
  provenance_es: string;
}

// The only plain-HTTPS mirror verified alive (2026-07-03); the canonical MineLib site rejects
// programmatic access (expired TLS + WAF). Fetched at runtime — never cached into the build.
const MIRROR = 'https://raw.githubusercontent.com/ampl/colab.ampl.com/master/authors/eduardosalaz/minelib/data';

export const REAL_CASES: RealCase[] = [
  {
    id: 'newman1', name: 'Newman1 (gold–copper test mine)', nBlocks: 1060, nPrecs: 3922,
    publishedOptimum: 26_086_899, gate: 'live',
    urls: {
      blocks: `${MIRROR}/newman1/newman1.blocks`,
      prec: `${MIRROR}/newman1/newman1.prec`,
      upit: `${MIRROR}/newman1/newman1.upit`,
    },
    provenance_en: 'MineLib 2013 · smallest instance · fetched live from the AMPL GitHub mirror.',
    provenance_es: 'MineLib 2013 · la instancia más pequeña · descargada en vivo del espejo AMPL en GitHub.',
  },
  {
    id: 'zuck_small', name: 'Zuck small (copper, Whittle 4X example)', nBlocks: 9400, nPrecs: 145_640,
    publishedOptimum: 1_422_726_898, gate: 'size-gated',
    urls: null, // no plain-HTTPS mirror found yet; archive source to be wired in #13
    provenance_en: 'MineLib 2013 · mid-size · solve starts only on explicit confirm (145k precedence arcs).',
    provenance_es: 'MineLib 2013 · tamaño medio · el solve parte sólo con confirmación explícita (145k arcos).',
  },
  {
    id: 'kd', name: 'KD (copper, McLaughlin-style deposit)', nBlocks: 14_153, nPrecs: 219_778,
    publishedOptimum: 652_195_037, gate: 'size-gated',
    urls: null, // no plain-HTTPS mirror found yet; archive source to be wired in #13
    provenance_en: 'MineLib 2013 · the live-solve ceiling · larger instances run in the offline bake lane.',
    provenance_es: 'MineLib 2013 · el techo del solve en vivo · instancias mayores corren en el carril offline.',
  },
];

/** The live real-data solve state machine the App renders from. #13 adds the 'solved' arm
 *  (parsed model + exact pit); until then the boundary reports itself pending — the UI and the
 *  registry are real, only the connection is pending. */
export type RealSolveState =
  | { status: 'idle' }
  | { status: 'fetching'; instance: string }
  | { status: 'solving'; instance: string }
  | { status: 'pending-13'; instance: string }
  | { status: 'error'; instance: string; message: string };

/** Boundary entry point: fetch + parse + solve a MineLib instance with the exact engine.
 *  Implemented in #13 (minelib.ts parsers + solveUpitExplicit reusing MaxFlow + Picard). */
export async function solveRealCase(rc: RealCase): Promise<RealSolveState> {
  return { status: 'pending-13', instance: rc.id };
}
