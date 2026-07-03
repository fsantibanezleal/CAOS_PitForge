// Fetch MineLib instances into the GITIGNORED local cache (frontend/.minelib-cache/).
// LICENSE: MineLib grants download for academic purposes only — the cache is never committed,
// never bundled, never served. Used by the local oracle test (test/minelib.test.ts) and the
// offline Benchmark bake (#17). CI must NOT run this script.
//
// Usage: node scripts/fetch-minelib.mjs [instanceId ...]   (default: newman1)
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIRROR = 'https://raw.githubusercontent.com/ampl/colab.ampl.com/master/authors/eduardosalaz/minelib/data';
const SOURCES = {
  newman1: ['blocks', 'prec', 'upit'].map((ext) => `${MIRROR}/newman1/newman1.${ext}`),
  // zuck_small / kd: no verified plain-HTTPS mirror yet — wire here when one is found (#17).
};

const cacheRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '.minelib-cache');
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : ['newman1'];

for (const id of wanted) {
  const urls = SOURCES[id];
  if (!urls) { console.error(`[fetch-minelib] no verified source for '${id}' — skipping`); continue; }
  const dir = join(cacheRoot, id);
  mkdirSync(dir, { recursive: true });
  for (const url of urls) {
    const file = join(dir, url.split('/').pop());
    if (existsSync(file)) { console.log(`[fetch-minelib] ${id}: ${url.split('/').pop()} cached`); continue; }
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    writeFileSync(file, await r.text());
    console.log(`[fetch-minelib] ${id}: fetched ${url.split('/').pop()}`);
  }
}
console.log(`[fetch-minelib] cache at ${cacheRoot} (gitignored — do not commit)`);
