import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Mountain } from 'lucide-react';
import { AppShell, applyTheme, CitationsProvider, readTheme, type ShellConfig } from '@fasl-work/caos-app-shell';
import '@fasl-work/caos-app-shell/styles.css';
import './pitforge.css';
import { CITATIONS } from './data/citations.ts';
import { architecture } from './architecture';
import Tool from './pages/Tool.tsx';
import Introduction from './pages/Introduction.tsx';
import Methodology from './pages/Methodology.tsx';
import Implementation from './pages/Implementation.tsx';
import Experiments from './pages/Experiments.tsx';
import Benchmark from './pages/Benchmark.tsx';

applyTheme(readTheme());

const config: ShellConfig = {
  product: { name: 'PitForge', mark: <Mountain size={18} aria-hidden="true" /> },
  routes: [
    { path: '/', en: 'App', es: 'App' },
    { path: '/introduction', en: 'Introduction', es: 'Introducción' },
    { path: '/methodology', en: 'Methodology', es: 'Metodología' },
    { path: '/implementation', en: 'Implementation', es: 'Implementación' },
    { path: '/experiments', en: 'Experiments', es: 'Experimentos' },
    { path: '/benchmark', en: 'Benchmark', es: 'Benchmark' },
  ],
  links: { github: 'https://github.com/fsantibanezleal/CAOS_PitForge' },
  version: '0.08.002',
  architecture,
  // ADR-0016 §2: honest footer provenance + disclaimer.
  footer: {
    provenance: {
      en: 'Real lane: published MineLib open-pit instances (Espinoza, Goycoolea, Moreno & Newman 2013, doi:10.1007/s10479-012-1258-3), fetched at runtime under their academic-only license and never bundled. Engine: Lerchs-Grossmann ultimate pit via exact max-flow/min-cut (Picard). Synthetic lane: seeded deposits + oreblocks-generated twins with generator-stamped optima.',
      es: 'Carril real: instancias de rajo abierto publicadas de MineLib (Espinoza, Goycoolea, Moreno & Newman 2013, doi:10.1007/s10479-012-1258-3), descargadas en tiempo de ejecución bajo su licencia académica y nunca empaquetadas. Motor: pit final de Lerchs-Grossmann por max-flow/min-cut exacto (Picard). Carril sintético: depósitos sembrados + gemelos generados con oreblocks y óptimo estampado por el generador.',
    },
    disclaimer: {
      en: 'A static, in-browser mine-design workbench: no backend. The exact min-cut is the authority and reproduces the published MineLib optima live; the ONNX learned models are fast triage, never a replacement. Not for production mine planning.',
      es: 'Un taller de diseño minero estático en el navegador: sin backend. El min-cut exacto es la autoridad y reproduce en vivo los óptimos publicados de MineLib; los modelos ONNX aprendidos son triaje rápido, nunca un reemplazo. No apto para planificación minera de producción.',
    },
  },
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CitationsProvider items={CITATIONS}>
        <AppShell config={config}>
          <Routes>
            <Route path="/" element={<Tool />} />
            <Route path="/introduction" element={<Introduction />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="/implementation" element={<Implementation />} />
            <Route path="/experiments" element={<Experiments />} />
            <Route path="/benchmark" element={<Benchmark />} />
            <Route path="*" element={<Tool />} />
          </Routes>
        </AppShell>
      </CitationsProvider>
    </BrowserRouter>
  </StrictMode>,
);
