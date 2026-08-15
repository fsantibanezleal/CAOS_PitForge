// Fetch MineLib instances into the GITIGNORED local cache (frontend/.minelib-cache/).
// LICENSE: MineLib is CC BY-SA 3.0 Unported. This project still keeps the source instances in a
// gitignored cache by engineering choice; only attributed aggregate results are committed.
// Used by the local oracle test, the offline Benchmark bake, and the published CPIT replay.
//
// Usage: node scripts/fetch-minelib.mjs [instanceId ...]   (default: newman1)
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIRROR = 'https://raw.githubusercontent.com/ampl/colab.ampl.com/master/authors/eduardosalaz/minelib/data';
const MIRROR2 = 'https://raw.githubusercontent.com/qarth/whattle/master/test/minelib';
const SOURCES = {
  newman1: ['blocks', 'prec', 'upit', 'cpit'].map((ext) => `${MIRROR}/newman1/newman1.${ext}`),
  zuck_small: ['blocks', 'prec', 'upit'].map((ext) => `${MIRROR2}/zuck_small/zuck_small.${ext}`),
  kd: ['blocks', 'prec', 'upit'].map((ext) => `${MIRROR2}/kd/kd.${ext}`),
  // mclaughlin: 83 MB .blocks / no .prec on any verified mirror, excluded-with-reason (see bake).
};

const cacheRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '.minelib-cache');
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SOURCES);

for (const id of wanted) {
  const urls = SOURCES[id];
  if (!urls) { console.error(`[fetch-minelib] no verified source for '${id}', skipping`); continue; }
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
console.log(`[fetch-minelib] cache at ${cacheRoot} (gitignored, do not commit)`);
