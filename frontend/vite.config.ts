import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// Keep the unknown-route fallback available during the Vite build. The postbuild script additionally emits real
// per-route index files so declared deep links return HTTP 200 instead of merely rendering through this 404 shell.
function spaFallback(): Plugin {
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    closeBundle() {
      const idx = resolve(__dirname, 'dist/index.html');
      if (existsSync(idx)) copyFileSync(idx, resolve(__dirname, 'dist/404.html'));
    },
  };
}

// Static SPA for GitHub Pages at pitforge.fasl-work.com (custom domain → base '/').
export default defineConfig({
  base: '/',
  plugins: [react(), spaFallback()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/uplot/')) return 'charts';
          if (id.includes('/katex/') || id.includes('@fasl-work/caos-app-shell')) return 'shell';
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router') || id.includes('/zustand/')) return 'react';
          return undefined;
        },
      },
    },
  },
});
