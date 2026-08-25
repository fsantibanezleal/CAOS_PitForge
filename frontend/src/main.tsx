import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Mountain } from 'lucide-react';
import { AppShell, applyTheme, CitationsProvider, readTheme, type ShellConfig, useLangStore } from '@fasl-work/caos-app-shell';
import '@fasl-work/caos-app-shell/styles.css';
import './pitforge.css';
import pkg from '../package.json';
import { CITATIONS } from './data/citations.ts';
import { architecture } from './architecture';
import Tool from './pages/Tool.tsx';
import Introduction from './pages/Introduction.tsx';
import Methodology from './pages/Methodology.tsx';
import Implementation from './pages/Implementation.tsx';
import Experiments from './pages/Experiments.tsx';
import Focus from './pages/Focus.tsx';
import Benchmark from './pages/Benchmark.tsx';

applyTheme(readTheme());

/** Keep assistive technology and browser translation aligned with the visible language. */
function DocumentLocale() {
  const lang = useLangStore((state) => state.lang);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === 'es'
      ? 'PitForge · rajo último y cáscaras anidadas'
      : 'PitForge · ultimate pit and nested shells';
  }, [lang]);
  return null;
}

// package.json must hold valid semver for npm; the line displays the padded X.XX.XXX form. Same
// helper FrothSeg uses, so the two spellings never become two sources of truth.
function displayVersion(semver: string): string {
  const [major = '0', minor = '0', patch = '0'] = semver.split('.');
  return `${major}.${minor.padStart(2, '0')}.${patch.padStart(3, '0')}`;
}

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
  // Derived, never restated. This was a hardcoded literal, so the footer showed v0.13.001 on a build
  // that was 24 commits and one minor release past it: the one string a reader uses to know WHAT is
  // deployed was the one string nothing kept true. Every other app on the line already derives it.
  version: displayVersion(pkg.version),
  architecture,
  // ADR-0016 §2: honest footer provenance + disclaimer.
  footer: {
    // ADR-0016 wants ONE LINE of provenance and ONE LINE of disclaimer. This carried a 60-word and a
    // 70-word paragraph, which rendered a 242px footer on a 900px viewport. The long form lives on
    // Methodology, Implementation and Benchmark and in the architecture modal.
    provenance: {
      en:
        'Real lane: MineLib instances, CC BY-SA 3.0 Unported (Espinoza, Goycoolea, Moreno and Newman 2013, ' +
        'doi:10.1007/s10479-012-1258-3), fetched at runtime, not bundled. Engine: exact maximum ' +
        'closure by min-cut (Picard). Synthetic lane: seeded twins from oreblocks (PyPI, MIT).',
      es:
        'Carril real: instancias MineLib, CC BY-SA 3.0 Unported (Espinoza, Goycoolea, Moreno y Newman 2013, ' +
        'doi:10.1007/s10479-012-1258-3), descargadas en tiempo de ejecución, no empaquetadas. Motor: ' +
        'cierre máximo exacto por min-cut (Picard). Carril sintético: gemelos sembrados de oreblocks ' +
        '(PyPI, MIT).',
    },
    disclaimer: {
      en:
        'The exact min-cut is the authority and reproduces the published MineLib optima live. The ' +
        'learned models are an approximate preview shown with their agreement against it, and never ' +
        'replace it. Not for production mine planning.',
      es:
        'El min-cut exacto es la autoridad y reproduce en vivo los óptimos publicados de MineLib. Los ' +
        'modelos aprendidos son una vista previa aproximada, mostrada con su acuerdo contra él, y ' +
        'nunca lo reemplazan. No apto para planificación minera de producción.',
    },
  },
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CitationsProvider items={CITATIONS}>
        <DocumentLocale />
        <Routes>
          {/* ADR-0070: the focus view renders OUTSIDE the shell. The header and footer are exactly the
              chrome a focus view exists to escape, so it cannot be a child of AppShell. */}
          <Route path="/focus/:caseId" element={<Focus />} />
          <Route path="*" element={
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
          } />
        </Routes>
      </CitationsProvider>
    </BrowserRouter>
  </StrictMode>,
);
