// MineLib instance support — parsers for the published .blocks / .prec / .upit formats, the
// explicit-precedence UPIT solve, and the dense-grid embedding the viz reads.
//
// Formats (verified against the live newman1 mirror bytes, 2026-07-03):
//   .blocks  one row per block: `id x y z <instance-specific free columns>`; id counts from 0,
//            z increases UPWARD (published convention — the opposite of our viz convention).
//   .prec    one row per block: `b n p_1 .. p_n` — the n blocks that must be extracted BEFORE b.
//   .upit    a short keyword header (NAME/TYPE/NBLOCKS/OBJECTIVE_FUNCTION:) then `b value` rows —
//            the authoritative net block value (destination already optimised per block).
//
// The free-column semantics of .blocks vary per instance, so each RealCase declares a
// BlocksLayout mapping token indices to grade/tonnage/density where known (newman1: 5/6/7).
//
// solveUpitExplicit reuses the exact machinery of the synthetic engine — Picard's max-closure →
// min-cut reduction on Dinic max-flow — with the published explicit precedence instead of the
// slope cone, and asserts the same value identity: pitValue = Σ positive − maxflow.

import { MaxFlow } from './maxflow.ts';
import { type BlockModel, type GridDims, idx } from './types.ts';

export interface BlocksLayout {
  /** token index (0-based, id=0 x=1 y=2 z=3) of each known free column. */
  grade?: number;
  tonnage?: number;
  density?: number;
}

export interface ParsedInstance {
  n: number;
  /** coords as published (z up). */
  x: Int32Array;
  y: Int32Array;
  z: Int32Array;
  /** net value per block, from .upit. */
  value: Float64Array;
  grade: Float64Array | null;
  tonnage: Float64Array | null;
  density: Float64Array | null;
  /** CSR over the predecessors of each block: precList[precStart[b] .. precStart[b+1]) must be mined before b. */
  precStart: Int32Array;
  precList: Int32Array;
  nPrecs: number;
}

const rows = (text: string): string[][] =>
  text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0).map((l) => l.split(/\s+/));

/** `.blocks`: coords by block id (rows may be unordered). Free columns are read via `layout`. */
export function parseBlocks(text: string, layout: BlocksLayout = {}): {
  n: number; x: Int32Array; y: Int32Array; z: Int32Array;
  grade: Float64Array | null; tonnage: Float64Array | null; density: Float64Array | null;
} {
  const rs = rows(text);
  const n = rs.length;
  const x = new Int32Array(n);
  const y = new Int32Array(n);
  const z = new Int32Array(n);
  const grade = layout.grade !== undefined ? new Float64Array(n) : null;
  const tonnage = layout.tonnage !== undefined ? new Float64Array(n) : null;
  const density = layout.density !== undefined ? new Float64Array(n) : null;
  for (const t of rs) {
    const id = Number(t[0]);
    if (!Number.isInteger(id) || id < 0 || id >= n) throw new Error(`.blocks: bad id ${t[0]} (n=${n})`);
    x[id] = Number(t[1]); y[id] = Number(t[2]); z[id] = Number(t[3]);
    if (!Number.isFinite(x[id] + y[id] + z[id])) throw new Error(`.blocks: bad coords for id ${id}`);
    if (grade) { grade[id] = Number(t[layout.grade!]); if (!Number.isFinite(grade[id])) throw new Error(`.blocks: bad grade for id ${id}`); }
    if (tonnage) { tonnage[id] = Number(t[layout.tonnage!]); if (!Number.isFinite(tonnage[id])) throw new Error(`.blocks: bad tonnage for id ${id}`); }
    if (density) { density[id] = Number(t[layout.density!]); if (!Number.isFinite(density[id])) throw new Error(`.blocks: bad density for id ${id}`); }
  }
  return { n, x, y, z, grade, tonnage, density };
}

/** `.prec`: CSR of predecessor lists. */
export function parsePrec(text: string, n: number): { precStart: Int32Array; precList: Int32Array; nPrecs: number } {
  const rs = rows(text);
  const counts = new Int32Array(n);
  for (const t of rs) {
    const b = Number(t[0]);
    const k = Number(t[1]);
    if (!Number.isInteger(b) || b < 0 || b >= n) throw new Error(`.prec: bad block id ${t[0]}`);
    if (!Number.isInteger(k) || k < 0 || t.length !== 2 + k) throw new Error(`.prec: row for ${b} declares ${t[1]} preds but has ${t.length - 2}`);
    counts[b] = k;
  }
  const precStart = new Int32Array(n + 1);
  for (let b = 0; b < n; b++) precStart[b + 1] = precStart[b] + counts[b];
  const precList = new Int32Array(precStart[n]);
  for (const t of rs) {
    const b = Number(t[0]);
    let at = precStart[b];
    for (let j = 2; j < t.length; j++) {
      const p = Number(t[j]);
      if (!Number.isInteger(p) || p < 0 || p >= n) throw new Error(`.prec: bad predecessor ${t[j]} for block ${b}`);
      precList[at++] = p;
    }
  }
  return { precStart, precList, nPrecs: precList.length };
}

/** `.upit`: skip keyword header lines, then `b value`. */
export function parseUpit(text: string, n: number): Float64Array {
  const value = new Float64Array(n).fill(NaN);
  for (const t of rows(text)) {
    if (!/^\d+$/.test(t[0])) continue; // header lines (NAME:, TYPE:, NBLOCKS:, OBJECTIVE_FUNCTION:)
    const b = Number(t[0]);
    const v = Number(t[1]);
    if (b < 0 || b >= n) throw new Error(`.upit: block id ${b} out of range (n=${n})`);
    if (!Number.isFinite(v)) throw new Error(`.upit: bad value for block ${b}`);
    value[b] = v;
  }
  for (let b = 0; b < n; b++) if (Number.isNaN(value[b])) throw new Error(`.upit: missing value for block ${b}`);
  return value;
}

export function parseMinelib(txt: { blocks: string; prec: string; upit: string }, layout: BlocksLayout = {}): ParsedInstance {
  const b = parseBlocks(txt.blocks, layout);
  const p = parsePrec(txt.prec, b.n);
  const value = parseUpit(txt.upit, b.n);
  return { n: b.n, x: b.x, y: b.y, z: b.z, value, grade: b.grade, tonnage: b.tonnage, density: b.density, ...p };
}

export interface ExplicitPit {
  /** per instance block. */
  inPit: Uint8Array;
  pitValue: number;
  sumPositive: number;
  maxflow: number;
  nInPit: number;
}

/** Exact UPIT over explicit precedence — same Picard/Dinic machinery as the synthetic engine.
 *  Self-checks closure feasibility and the value identity before returning. */
export function solveUpitExplicit(value: Float64Array, precStart: Int32Array, precList: Int32Array): ExplicitPit {
  const n = value.length;
  const S = n;
  const T = n + 1;
  let sumPositive = 0;
  for (let i = 0; i < n; i++) if (value[i] > 0) sumPositive += value[i];
  const INF = sumPositive + 1;

  const mf = new MaxFlow(n + 2);
  for (let i = 0; i < n; i++) {
    if (value[i] > 0) mf.addEdge(S, i, value[i]);
    else if (value[i] < 0) mf.addEdge(i, T, -value[i]);
  }
  for (let b = 0; b < n; b++) for (let e = precStart[b]; e < precStart[b + 1]; e++) mf.addEdge(b, precList[e], INF);

  const maxflow = mf.maxflow(S, T);
  const reachable = mf.minCutReachable(S);

  const inPit = new Uint8Array(n);
  let pitValue = 0;
  let nInPit = 0;
  for (let i = 0; i < n; i++) {
    if (!reachable[i]) continue;
    inPit[i] = 1;
    pitValue += value[i];
    nInPit++;
  }
  // self-checks: the pit must be a valid closure, and the min-cut identity must hold.
  for (let b = 0; b < n; b++) {
    if (!inPit[b]) continue;
    for (let e = precStart[b]; e < precStart[b + 1]; e++) {
      if (!inPit[precList[e]]) throw new Error(`closure violated: block ${b} in pit, predecessor ${precList[e]} not`);
    }
  }
  const gap = Math.abs(pitValue - (sumPositive - maxflow));
  if (gap > Math.max(1e-6 * Math.max(1, sumPositive), 1e-3)) throw new Error(`value identity violated: gap ${gap}`);
  return { inPit, pitValue, sumPositive, maxflow, nInPit };
}

export interface RealEmbedding {
  /** dense bounding-box grid in the viz convention (z DOWN, z=0 = highest published level). */
  model: BlockModel;
  dims: GridDims;
  /** 1 where an instance block exists at the dense cell. */
  present: Uint8Array;
  /** dense cell → instance block id, -1 where absent. */
  instOf: Int32Array;
  /** net value on the dense grid (0 where absent). */
  value: Float64Array;
  gradeAvailable: boolean;
  tonnageAvailable: boolean;
}

/** Embed a sparse published instance into a dense bounding-box grid so the standard section /
 *  3-D viz can render it. Grade/tonnage stay in as-published per-instance units. */
export function buildRealEmbedding(p: ParsedInstance, name: string): RealEmbedding {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < p.n; i++) {
    if (p.x[i] < x0) x0 = p.x[i]; if (p.x[i] > x1) x1 = p.x[i];
    if (p.y[i] < y0) y0 = p.y[i]; if (p.y[i] > y1) y1 = p.y[i];
    if (p.z[i] < z0) z0 = p.z[i]; if (p.z[i] > z1) z1 = p.z[i];
  }
  const dims: GridDims = { nx: x1 - x0 + 1, ny: y1 - y0 + 1, nz: z1 - z0 + 1 };
  const N = dims.nx * dims.ny * dims.nz;
  const present = new Uint8Array(N);
  const instOf = new Int32Array(N).fill(-1);
  const value = new Float64Array(N);
  const grade = new Float64Array(N);
  const tonnage = new Float64Array(N);
  const density = new Float64Array(N);
  for (let i = 0; i < p.n; i++) {
    // published z is UP; the viz convention is z DOWN from the surface bench.
    const d = idx(dims, p.x[i] - x0, p.y[i] - y0, z1 - p.z[i]);
    if (present[d]) throw new Error(`duplicate block at published coords (${p.x[i]},${p.y[i]},${p.z[i]})`);
    present[d] = 1;
    instOf[d] = i;
    value[d] = p.value[i];
    if (p.grade) grade[d] = p.grade[i];
    if (p.tonnage) tonnage[d] = p.tonnage[i];
    if (p.density) density[d] = p.density[i];
  }
  const model: BlockModel = {
    dims,
    block: { dx: 1, dy: 1, dz: 1 }, // published instances give index geometry only
    tonnage, density, grade,
    meta: { name, archetype: 'published (MineLib)', gradeUnit: 'as published (per-instance units)' },
  };
  return { model, dims, present, instOf, value, gradeAvailable: !!p.grade, tonnageAvailable: !!p.tonnage };
}
