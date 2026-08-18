// OFFLINE MineLib benchmark bake, run LOCALLY, never in CI (CI must not fetch MineLib):
//   node --import tsx scripts/bake-minelib.mjs        (after scripts/fetch-minelib.mjs)
// Reads the GITIGNORED .minelib-cache, solves each instance with both exact engines
// (Dinic and normalised-tree pseudoflow), and writes data/derived/minelib-results.json, SUMMARY numbers only
// (counts, values, runtimes; the published optima are already public facts). Instance files are
// never committed by project policy (MineLib itself is CC BY-SA 3.0 Unported).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMinelib, solveUpitExplicit } from '../src/opt/minelib.ts';
import { REAL_CASES } from '../src/opt/realCases.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, '..', '.minelib-cache');
const OUT = resolve(HERE, '..', '..', 'data', 'derived', 'minelib-results.json');

const results = [];
for (const rc of REAL_CASES) {
  const dir = join(CACHE, rc.id);
  const files = ['blocks', 'prec', 'upit'].map((ext) => join(dir, `${rc.id}.${ext}`));
  if (!files.every((f) => existsSync(f))) {
    console.warn(`[bake-minelib] ${rc.id}: not in cache, run scripts/fetch-minelib.mjs first`);
    continue;
  }
  const [blocks, prec, upit] = files.map((f) => readFileSync(f, 'utf8'));
  const t0 = performance.now();
  const inst = parseMinelib({ blocks, prec, upit }, rc.blocksLayout);
  const t1 = performance.now();
  // Median-of-3 includes the cold first run and exposes an honest local comparison.
  const bench = (solver) => {
    let pit;
    const times = [];
    for (let k = 0; k < 3; k++) {
      const s0 = performance.now();
      pit = solveUpitExplicit(inst.value, inst.precStart, inst.precList, solver);
      times.push(performance.now() - s0);
    }
    times.sort((a, b) => a - b);
    return { pit, medianMs: Math.round(times[1] * 10) / 10 };
  };
  const dinic = bench('dinic');
  const pseudoflow = bench('pseudoflow');
  let blockSetDifference = 0;
  for (let i = 0; i < inst.n; i++) if (dinic.pit.inPit[i] !== pseudoflow.pit.inPit[i]) blockSetDifference++;
  const solverValueDifference = Math.abs(dinic.pit.pitValue - pseudoflow.pit.pitValue);
  const relError = Math.abs(dinic.pit.pitValue - rc.publishedOptimum) / rc.publishedOptimum;
  results.push({
    id: rc.id, name: rc.name, nBlocks: inst.n, nPrecs: inst.nPrecs,
    publishedOptimum: rc.publishedOptimum,
    ourValue: Math.round(dinic.pit.pitValue * 1000) / 1000,
    relError,
    match: relError <= 2e-9,
    nInPit: dinic.pit.nInPit,
    parseMs: Math.round(t1 - t0),
    dinicMsMedian: dinic.medianMs,
    pseudoflowMsMedian: pseudoflow.medianMs,
    solverValueDifference,
    blockSetDifference,
    solverAgreement: solverValueDifference <= Math.max(1e-6, Math.abs(dinic.pit.pitValue) * 1e-12) && blockSetDifference === 0,
    pseudoflowStats: pseudoflow.pit.pseudoflowStats,
  });
  console.log(`[bake-minelib] ${rc.id}: ${dinic.pit.pitValue.toFixed(3)} vs published ${rc.publishedOptimum} ` +
    `(rel ${relError.toExponential(2)}), Dinic ${dinic.medianMs} ms, pseudoflow ${pseudoflow.medianMs} ms, block diff ${blockSetDifference}`);
}

// the rest of the published library, excluded with reasons (counts/optima are published facts).
const excluded = [
  { id: 'marvin', nBlocks: 53_271, publishedOptimum: 1_415_655_436, reason: 'ships with the commercial Whittle software; no verified public mirror' },
  { id: 'mclaughlin_limit', nBlocks: 112_687, publishedOptimum: 1_495_726_474, reason: 'no verified public mirror (canonical site rejects programmatic access)' },
  { id: 'mclaughlin', nBlocks: 2_140_342, publishedOptimum: null, reason: 'no .prec on any verified mirror; 73M-arc scale untested for this Dinic, offline-infeasible for now' },
];

writeFileSync(OUT, JSON.stringify({
  schema: 'pitforge.minelib-bench/v2',
  bakedAt: new Date().toISOString(),
  engine: 'solveUpitExplicit (Picard maximum closure; Dinic and Hochbaum normalised-tree pseudoflow rungs; TypeScript, Node)',
  license: 'MineLib CC BY-SA 3.0 Unported; only attributed summary numbers are committed by project policy',
  results, excluded,
}, null, 2));
console.log(`[bake-minelib] wrote ${OUT} (${results.length} baked, ${excluded.length} excluded-with-reason)`);
