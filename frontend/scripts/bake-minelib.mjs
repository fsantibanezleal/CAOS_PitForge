// OFFLINE MineLib benchmark bake, run LOCALLY, never in CI (CI must not fetch MineLib):
//   node --import tsx scripts/bake-minelib.mjs        (after scripts/fetch-minelib.mjs)
// Reads the GITIGNORED .minelib-cache, solves each instance with both exact engines
// (Dinic and normalised-tree pseudoflow), and writes data/derived/minelib-results.json, SUMMARY numbers only
// (counts, values, runtimes; the published optima are already public facts). Instance files are
// never committed by project policy (MineLib itself is CC BY-SA 3.0 Unported).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { parseMinelib, solveUpitExplicit } from '../src/opt/minelib.ts';
import { REAL_CASES } from '../src/opt/realCases.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, '..', '.minelib-cache');
const OUT = resolve(HERE, '..', '..', 'data', 'derived', 'minelib-results.json');

const TWINS = resolve(HERE, '..', 'public', 'twins');

// Each RealCase has its OWN source root: the three PUBLISHED MineLib instances are fetched into the
// gitignored .minelib-cache, while the three synthetic twins are committed under public/twins. The
// loop used to resolve only the cache, so the twins were skipped with a console.warn on every bake
// and the artifact silently shipped 3 of the 6 declared cases while every gate stayed green.
const sourceFiles = (rc) => ['blocks', 'prec', 'upit'].map((ext) =>
  rc.synthetic ? join(TWINS, `${rc.id}.${ext}`) : join(CACHE, rc.id, `${rc.id}.${ext}`));

const results = [];
const missing = [];
for (const rc of REAL_CASES) {
  const files = sourceFiles(rc);
  if (!files.every((f) => existsSync(f))) {
    missing.push(rc.id);
    console.warn(`[bake-minelib] ${rc.id}: source missing at ${files[0]}`);
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
  { id: 'mclaughlin', nBlocks: 2_140_342, publishedOptimum: 1_495_886_962, reason: 'no .prec on any verified mirror; 73M-arc scale untested for this Dinic, offline-infeasible for now' },
  // MineLib publishes ELEVEN instances. The five below appeared in neither `results` nor `excluded`,
  // so the artifact silently implied the library was smaller than it is. Named here with an honest
  // reason; no optimum is asserted for an instance this project has not solved.
  { id: 'zuck_medium', nBlocks: 29_277, publishedOptimum: null, reason: 'not attempted: no verified public mirror located by this project' },
  { id: 'p4hd', nBlocks: 40_947, publishedOptimum: null, reason: 'not attempted: no verified public mirror located by this project' },
  { id: 'w23', nBlocks: 74_260, publishedOptimum: null, reason: 'not attempted: no verified public mirror located by this project' },
  { id: 'zuck_large', nBlocks: 96_821, publishedOptimum: null, reason: 'not attempted: no verified public mirror located by this project' },
  { id: 'sm2', nBlocks: 99_014, publishedOptimum: null, reason: 'not attempted: no verified public mirror located by this project' },
];

// DECLARED vs SHIPPED. A silent `continue` above used to let the artifact ship fewer cases than the
// product declares while every gate stayed green. Refuse instead.
if (missing.length) {
  throw new Error(
    `[bake-minelib] REFUSING to write a partial artifact: ${missing.length} of ${REAL_CASES.length} ` +
    `declared cases have no source on disk (${missing.join(', ')}). ` +
    'Published instances: node frontend/scripts/fetch-minelib.mjs. Twins are committed under frontend/public/twins.',
  );
}

writeFileSync(OUT, JSON.stringify({
  schema: 'pitforge.minelib-bench/v3',
  bakedAt: new Date().toISOString(),
  engine: 'solveUpitExplicit (Picard maximum closure; Dinic and Hochbaum normalised-tree pseudoflow rungs; TypeScript, Node)',
  license: 'MineLib CC BY-SA 3.0 Unported; only attributed summary numbers are committed by project policy',
  // The optima and relative errors below are properties of the ALGORITHM and reproduce anywhere.
  // The milliseconds are NOT: they are one machine, one run. Measured repeatedly on the same
  // laptop, zuck_small came out at 111, 234 and 527 ms, so quoting a tenth of a millisecond as a
  // product characteristic is false precision. The environment is recorded here so a reader can
  // see what the number is a property of, and the external surfaces quote scale, not decimals.
  timingEnvironment: {
    note: 'Machine-dependent. Same-machine repeat runs vary by 2-5x; treat these as scale, not as a benchmark.',
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    cpus: os.cpus().length,
    cpuModel: (os.cpus()[0] || {}).model || 'unknown',
  },
  results, excluded,
}, null, 2));
console.log(`[bake-minelib] wrote ${OUT} (${results.length} baked, ${excluded.length} excluded-with-reason)`);
