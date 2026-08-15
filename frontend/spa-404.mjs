// SPA deep-link fallback for GitHub Pages. The app uses BrowserRouter (history API), so a hard navigation / reload /
// shared link to a sub-route (e.g. /methodology) hits GitHub Pages directly, which has no such file and serves its 404.
// A 404 fallback renders correctly but still returns HTTP 404. That breaks link checkers, search indexing, and
// monitoring. We therefore emit a real `<route>/index.html` for every declared static route and every canonical focus
// route, while keeping 404.html only for genuinely unknown paths. Runs after vite has finalised hashed asset paths.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), 'dist');
const index = resolve(dist, 'index.html');
if (!existsSync(index)) {
  console.error('[spa-404] dist/index.html not found, run after `vite build`');
  process.exit(1);
}
copyFileSync(index, resolve(dist, '404.html'));

const routes = [
  'introduction', 'methodology', 'implementation', 'experiments', 'benchmark',
  ...['A01', 'A02', 'A03', 'A04', 'E01', 'E02', 'G01', 'G02', 'CTRL'].map((id) => `focus/${id}`),
];
for (const route of routes) {
  const target = resolve(dist, route, 'index.html');
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(index, target);
  if (!existsSync(target)) throw new Error(`[spa-404] failed to emit ${route}/index.html`);
}
console.log(`[spa-404] emitted ${routes.length} HTTP-200 route entries + 404.html fallback`);
