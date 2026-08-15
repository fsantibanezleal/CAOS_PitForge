// Prebuild: overlay the committed CONTRACT-2 artifacts (../data/derived) into the SPA's public/ so the static site
// loads them. Canonical copies live in ../data/derived, public/ is a build-time overlay (git-ignored). PitForge's
// live lane is the TypeScript optimiser (frontend/src/opt/) + onnxruntime-web; there is no Pyodide lane to inline.
import { copyFileSync, cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PUB = join(HERE, 'public');
const derived = join(ROOT, 'data', 'derived');
const ortDist = join(HERE, 'node_modules', 'onnxruntime-web', 'dist');
const ortPublic = join(PUB, 'ort-runtime');

// Keep inference self-contained: the WASM execution provider is served by the same origin as the
// SPA, so private deployments and offline installations never depend on a third-party CDN.
mkdirSync(ortPublic, { recursive: true });
for (const file of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
  const src = join(ortDist, file);
  if (!existsSync(src)) throw new Error(`[copy-data] missing pinned onnxruntime-web asset: ${file}`);
  copyFileSync(src, join(ortPublic, file));
}

if (!existsSync(derived)) {
  console.warn('[copy-data] no data/derived, run `npm run bake` (or `python data-pipeline/run.py all`) first');
} else {
  // 1) data/derived -> public/data (per-case <case>/trace.json + manifests/ incl. index.json + case-results.json).
  mkdirSync(join(PUB, 'data'), { recursive: true });
  cpSync(derived, join(PUB, 'data'), { recursive: true });
  // 2) the App + onnxruntime-web fetch these from the SITE ROOT, so place them there too (when present).
  for (const f of ['case-results.json', 'pit-learned.json', 'minelib-results.json', 'cpit-schedule.json', 'grade-nn.onnx', 'pit-surrogate.onnx']) {
    const src = join(derived, f);
    if (existsSync(src)) copyFileSync(src, join(PUB, f));
  }
  console.log('[copy-data] data/derived -> public/data (+ root-level case-results / onnx); ONNX WASM -> public/ort-runtime');
}
