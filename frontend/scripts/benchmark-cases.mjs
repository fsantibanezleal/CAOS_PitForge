// Build the committed reference-runtime evidence consumed by the live/precompute gate. This is deliberately a
// separate, operator-run benchmark rather than part of the deterministic artifact bake: wall-clock measurements
// vary by machine, while traces and manifests must reproduce byte-for-byte from one reviewed evidence record.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { CASES, caseModel } from '../src/opt/cases.ts';
import { defaultRevenueFactors, nestedPitShells, solveUltimatePit } from '../src/opt/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(HERE, '../../data/derived/runtime-benchmarks.json');
const RFS = defaultRevenueFactors(12);
const RUNS = 5;

const measure = (fn) => {
  fn();
  const samples = [];
  for (let run = 0; run < RUNS; run++) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return Math.round(samples[Math.floor(samples.length / 2)] * 10) / 10;
};

const cases = {};
for (const c of CASES) {
  const model = caseModel(c);
  const medianMs = measure(() => {
    solveUltimatePit(model, { ...c.econ, revenueFactor: 1 });
    nestedPitShells(model, c.econ, RFS);
  });
  cases[c.id] = { median_ms: medianMs };
}

const out = {
  schema: 'pitforge.runtime-benchmarks/v1',
  source: 'frontend/scripts/benchmark-cases.mjs, Node reference median of 5 warm runs',
  environment: { runtime: process.version, platform: process.platform, arch: process.arch },
  workload: 'one ultimate-pit solve plus 12 nested revenue-factor shells',
  cases,
};
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(out), 'utf8');
console.log(`benchmarked ${Object.keys(cases).length} cases -> ${OUTPUT}`);
