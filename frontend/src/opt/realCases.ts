// The REAL block-model registry — MineLib benchmark instances (Espinoza, Goycoolea, Moreno &
// Newman 2013, Annals of OR 206:93–114, doi:10.1007/s10479-012-1258-3).
//
// LICENSE POSTURE (issue #11 re-analysis). MineLib's only grant is "these files may be downloaded
// for academic purposes" — there is NO redistribution permission (datasets come from anonymous
// industrial donors; marvin ships with the commercial Whittle software). Therefore instance files
// are NEVER committed to this repo and never bundled into the SPA. The app fetches them at
// runtime into browser memory only; the offline bake (#17) uses a gitignored local cache. Only
// SUMMARY facts live here (block/arc counts and the published UPIT optima are already public).

import {
  type BlocksLayout, buildRealEmbedding, parseMinelib, type RealEmbedding, solveUpitExplicit,
} from './minelib.ts';

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
  /** plain-HTTPS runtime-fetch endpoints, or null when no verified mirror exists yet. */
  urls: { blocks: string; prec: string; upit: string } | null;
  /** token indices of known free columns in this instance's .blocks rows (semantics are per-instance). */
  blocksLayout: BlocksLayout;
  provenance_en: string;
  provenance_es: string;
}

// Plain-HTTPS mirrors verified alive (2026-07-03); the canonical MineLib site rejects
// programmatic access (expired TLS + WAF). Fetched at runtime — never cached into the build.
const MIRROR = 'https://raw.githubusercontent.com/ampl/colab.ampl.com/master/authors/eduardosalaz/minelib/data';
const MIRROR2 = 'https://raw.githubusercontent.com/qarth/whattle/master/test/minelib';

export const REAL_CASES: RealCase[] = [
  {
    id: 'newman1', name: 'Newman1 (gold–copper test mine)', nBlocks: 1060, nPrecs: 3922,
    publishedOptimum: 26_086_899, gate: 'live',
    urls: {
      blocks: `${MIRROR}/newman1/newman1.blocks`,
      prec: `${MIRROR}/newman1/newman1.prec`,
      upit: `${MIRROR}/newman1/newman1.upit`,
    },
    // verified against the mirror bytes: id x y z rocktype grade tonnage density costIfWaste valueIfOre flag
    blocksLayout: { grade: 5, tonnage: 6, density: 7 },
    provenance_en: 'MineLib 2013 · smallest instance · fetched live from the AMPL GitHub mirror.',
    provenance_es: 'MineLib 2013 · la instancia más pequeña · descargada en vivo del espejo AMPL en GitHub.',
  },
  {
    id: 'zuck_small', name: 'Zuck small (copper, Whittle 4X example)', nBlocks: 9400, nPrecs: 145_640,
    publishedOptimum: 1_422_726_898, gate: 'size-gated',
    urls: {
      blocks: `${MIRROR2}/zuck_small/zuck_small.blocks`,
      prec: `${MIRROR2}/zuck_small/zuck_small.prec`,
      upit: `${MIRROR2}/zuck_small/zuck_small.upit`,
    },
    blocksLayout: {}, // free columns are cost/value variants — no grade/tonnage semantics declared
    provenance_en: 'MineLib 2013 · mid-size · fetched from the whattle GitHub mirror; solve starts on your confirm (~1.3 MB, 145k arcs).',
    provenance_es: 'MineLib 2013 · tamaño medio · descargada del espejo whattle en GitHub; el solve parte con tu confirmación (~1.3 MB, 145k arcos).',
  },
  {
    id: 'kd', name: 'KD (copper, McLaughlin-style deposit)', nBlocks: 14_153, nPrecs: 219_778,
    publishedOptimum: 652_195_037, gate: 'size-gated',
    urls: {
      blocks: `${MIRROR2}/kd/kd.blocks`,
      prec: `${MIRROR2}/kd/kd.prec`,
      upit: `${MIRROR2}/kd/kd.upit`,
    },
    // verified against the mirror bytes: header row + id x y z tonn blockvalue destination CU process_profit
    blocksLayout: { tonnage: 4, grade: 7 },
    provenance_en: 'MineLib 2013 · the live-solve ceiling · whattle GitHub mirror; solve starts on your confirm (~2 MB, 220k arcs).',
    provenance_es: 'MineLib 2013 · el techo del solve en vivo · espejo whattle en GitHub; el solve parte con tu confirmación (~2 MB, 220k arcos).',
  },
];

/** A completed live solve: the embedded model + the exact pit + the published-optimum check. */
export interface RealSolved {
  status: 'solved';
  instance: string;
  embedding: RealEmbedding;
  /** per DENSE cell (0 where absent). */
  inPitDense: Uint8Array;
  /** per instance block — feeds the value histogram + grade–tonnage. */
  instValue: Float64Array;
  instInPit: Uint8Array;
  instGrade: Float64Array | null;
  instTonnage: Float64Array | null;
  pitValue: number;
  sumPositive: number;
  maxflow: number;
  nInPit: number;
  publishedOptimum: number;
  /** |pitValue − published| ≤ 1e-6·published → the solver reproduces the published optimum. */
  matchPublished: boolean;
  fetchMs: number;
  solveMs: number;
}

export type RealSolveState =
  | { status: 'idle' }
  | { status: 'no-source'; instance: string }
  | { status: 'needs-confirm'; instance: string }
  | { status: 'fetching'; instance: string }
  | { status: 'solving'; instance: string }
  | RealSolved
  | { status: 'error'; instance: string; message: string };

const cache = new Map<string, RealSolved>();

/** Synchronous cache peek — lets the UI skip the size-gate confirm for already-solved instances. */
export const peekRealCase = (id: string): RealSolved | null => cache.get(id) ?? null;

/** Fetch + parse + solve a MineLib instance with the exact engine (browser memory only). */
export async function solveRealCase(rc: RealCase): Promise<RealSolveState> {
  const hit = cache.get(rc.id);
  if (hit) return hit;
  if (!rc.urls) return { status: 'no-source', instance: rc.id };

  const t0 = performance.now();
  const [blocks, prec, upit] = await Promise.all(
    [rc.urls.blocks, rc.urls.prec, rc.urls.upit].map(async (u) => {
      const r = await fetch(u);
      if (!r.ok) throw new Error(`fetch ${u.split('/').pop()}: HTTP ${r.status}`);
      return r.text();
    }),
  );
  const t1 = performance.now();

  const parsed = parseMinelib({ blocks, prec, upit }, rc.blocksLayout);
  if (parsed.n !== rc.nBlocks) throw new Error(`parsed ${parsed.n} blocks, published ${rc.nBlocks}`);
  if (parsed.nPrecs !== rc.nPrecs) throw new Error(`parsed ${parsed.nPrecs} precedence arcs, published ${rc.nPrecs}`);

  const pit = solveUpitExplicit(parsed.value, parsed.precStart, parsed.precList);
  const t2 = performance.now();

  const embedding = buildRealEmbedding(parsed, rc.name);
  const inPitDense = new Uint8Array(embedding.model.dims.nx * embedding.model.dims.ny * embedding.model.dims.nz);
  for (let d = 0; d < inPitDense.length; d++) if (embedding.instOf[d] >= 0) inPitDense[d] = pit.inPit[embedding.instOf[d]];

  const solved: RealSolved = {
    status: 'solved', instance: rc.id, embedding, inPitDense,
    instValue: parsed.value, instInPit: pit.inPit, instGrade: parsed.grade, instTonnage: parsed.tonnage,
    pitValue: pit.pitValue, sumPositive: pit.sumPositive, maxflow: pit.maxflow, nInPit: pit.nInPit,
    publishedOptimum: rc.publishedOptimum,
    matchPublished: Math.abs(pit.pitValue - rc.publishedOptimum) <= 1e-6 * rc.publishedOptimum,
    fetchMs: t1 - t0, solveMs: t2 - t1,
  };
  cache.set(rc.id, solved);
  return solved;
}
