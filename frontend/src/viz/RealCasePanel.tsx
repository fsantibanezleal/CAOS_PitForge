import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Tabs } from '@fasl-work/caos-app-shell';
import { solveRealCase, type RealCase, type RealSolved, type RealSolveState } from '../opt/realCases.ts';
import { idx } from '../opt/types.ts';
import { SectionView, type SectionCell } from './SectionView.tsx';
import { BarMini } from './BarMini.tsx';
import { viridisCss } from './colormap.ts';

const PitView3D = lazy(() => import('./PitView3D.tsx').then((m) => ({ default: m.PitView3D })));
const fInt = (v: number) => Math.round(v).toLocaleString('en-US');

/** The real-source workbench: fetch + exact solve of a published MineLib instance, then the same
 *  domain views as the synthetic side — 3-D pit, section, summary, block-value histogram and
 *  grade–tonnage (where the instance publishes grade/tonnage columns). Whittle/pushbacks need an
 *  RF sweep, which needs a per-instance econ decomposition — documented out of the v1 real mode. */
export function RealCasePanel({ rc, es }: { rc: RealCase; es: boolean }) {
  const [state, setState] = useState<RealSolveState>({ status: 'idle' });

  useEffect(() => {
    let alive = true;
    if (!rc.urls) { setState({ status: 'no-source', instance: rc.id }); return; }
    setState({ status: 'fetching', instance: rc.id });
    solveRealCase(rc)
      .then((s) => { if (alive) setState(s); })
      .catch((e) => { if (alive) setState({ status: 'error', instance: rc.id, message: String(e?.message ?? e) }); });
    return () => { alive = false; };
  }, [rc]);

  if (state.status === 'solved') return <SolvedTabs rc={rc} s={state} es={es} />;

  return (
    <div className="pf-vizstack">
      <div className="pf-plot-t">{es ? `Instancia real · ${rc.name}` : `Real instance · ${rc.name}`}</div>
      <div className="pf-kpis">
        <Kpi label={es ? 'bloques' : 'blocks'} value={fInt(rc.nBlocks)} />
        <Kpi label={es ? 'arcos de precedencia' : 'precedence arcs'} value={fInt(rc.nPrecs)} />
        <Kpi label={es ? 'óptimo UPIT publicado' : 'published UPIT optimum'} value={fInt(rc.publishedOptimum)} />
        <Kpi label={es ? 'carril' : 'gate'} value={rc.gate} />
      </div>
      <p className="pf-note">{es ? rc.provenance_es : rc.provenance_en}</p>
      {state.status === 'fetching' && <p className="pf-note">{es ? 'descargando la instancia…' : 'fetching the instance…'}</p>}
      {state.status === 'solving' && <p className="pf-note">{es ? 'resolviendo (min-cut exacto)…' : 'solving (exact min-cut)…'}</p>}
      {state.status === 'no-source' && (
        <p className="pf-note">{es
          ? 'Sin espejo runtime verificado para esta instancia todavía: corre en el carril offline del Benchmark (resultados resumidos vs el óptimo publicado), no en vivo.'
          : 'No verified runtime mirror for this instance yet: it runs in the offline Benchmark lane (summary results vs the published optimum), not live.'}</p>
      )}
      {state.status === 'error' && <p className="pf-note">⚠ {state.message}</p>}
      <p className="pf-cap">{es
        ? 'Los archivos MineLib se descargan en runtime a memoria del navegador y nunca se redistribuyen con la app (la licencia sólo permite descarga con fines académicos).'
        : 'MineLib files are fetched at runtime into browser memory and never redistributed with the app (the license only grants download for academic purposes).'}</p>
    </div>
  );
}

function SolvedTabs({ rc, s, es }: { rc: RealCase; s: RealSolved; es: boolean }) {
  const { model, present, value, gradeAvailable, tonnageAvailable } = s.embedding;
  const dims = model.dims;
  const [iy, setIy] = useState(Math.floor(dims.ny / 2));
  const [mode3d, setMode3d] = useState<'pit' | 'grade'>('pit');
  useEffect(() => { setIy(Math.floor(dims.ny / 2)); }, [dims.ny]);

  const gradeMax = useMemo(() => {
    let m = 0;
    for (let i = 0; i < model.grade.length; i++) if (present[i] && model.grade[i] > m) m = model.grade[i];
    return m;
  }, [model, present]);
  const valAbsMax = useMemo(() => {
    let m = 0;
    for (let i = 0; i < s.instValue.length; i++) { const a = Math.abs(s.instValue[i]); if (a > m) m = a; }
    return m || 1;
  }, [s]);

  // section cells: colour by grade when published, else by net value; absent cells stay empty.
  const cell = (ix: number, iz: number): SectionCell => {
    const i = idx(dims, ix, iy, iz);
    if (!present[i]) return { color: null, inPit: false, label: `(${ix},${iz}) · ${es ? 'sin bloque' : 'no block'}` };
    const t = gradeAvailable ? Math.min(1, model.grade[i] / (gradeMax || 1)) : 0.5 + 0.5 * (value[i] / valAbsMax);
    const what = gradeAvailable ? `${es ? 'ley' : 'grade'} ${model.grade[i].toFixed(3)}` : `${es ? 'valor' : 'value'} ${fInt(value[i])}`;
    return {
      color: viridisCss(Math.max(0, Math.min(1, t))),
      inPit: !!s.inPitDense[i],
      label: `(${ix},${iz}) · ${what} · ${s.inPitDense[i] ? (es ? 'en el pit' : 'in pit') : (es ? 'no minado' : 'not mined')}`,
    };
  };

  // block-value histogram over the INSTANCE values (the published net values, not a re-derivation).
  const hist = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < s.instValue.length; i++) { const v = s.instValue[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    const nb = 28;
    const bins = new Array(nb).fill(0);
    for (let i = 0; i < s.instValue.length; i++) {
      bins[Math.min(nb - 1, Math.max(0, Math.floor(((s.instValue[i] - lo) / (hi - lo || 1)) * nb)))]++;
    }
    return { bins, lo, hi };
  }, [s]);

  // grade–tonnage over the published columns (newman1 ships grade + tonnage per block).
  const gt = useMemo(() => {
    if (!s.instGrade || !s.instTonnage) return null;
    let gmax = 0;
    for (let i = 0; i < s.instGrade.length; i++) if (s.instGrade[i] > gmax) gmax = s.instGrade[i];
    const cutoffs = Array.from({ length: 24 }, (_, k) => (k / 23) * gmax);
    return cutoffs.map((cut) => {
      let t = 0;
      for (let i = 0; i < s.instGrade!.length; i++) if (s.instGrade![i] >= cut) t += s.instTonnage![i];
      return { cut, tonnes: t };
    });
  }, [s]);

  const pitTonnes = useMemo(() => {
    if (!s.instTonnage) return null;
    let t = 0;
    for (let i = 0; i < s.instTonnage.length; i++) if (s.instInPit[i]) t += s.instTonnage[i];
    return t;
  }, [s]);

  const matchChip = s.matchPublished
    ? (es ? '✓ reproduce el óptimo publicado' : '✓ reproduces the published optimum')
    : (es ? `✗ difiere del publicado (Δ ${fInt(s.pitValue - s.publishedOptimum)})` : `✗ differs from published (Δ ${fInt(s.pitValue - s.publishedOptimum)})`);

  const tabs = [
    {
      id: 'pit3d', label: '3D · pit',
      content: (
        <div className="pf-vizstack">
          <div className="pf-plot-th">
            <div className="pf-plot-t">{es ? 'Pit último EXACTO sobre la instancia publicada; orbita para rotar' : 'EXACT ultimate pit on the published instance; orbit to rotate'}</div>
            <div className="pf-seg">
              <button className={`chip ${mode3d === 'pit' ? 'on' : ''}`} onClick={() => setMode3d('pit')}>{es ? 'solo pit' : 'pit only'}</button>
              {gradeAvailable && (
                <button className={`chip ${mode3d === 'grade' ? 'on' : ''}`} onClick={() => setMode3d('grade')}>{es ? 'orebody (ley)' : 'orebody (grade)'}</button>
              )}
            </div>
          </div>
          <Suspense fallback={<div className="pf-plot" style={{ height: 360 }}>{es ? 'cargando 3D…' : 'loading 3D…'}</div>}>
            <PitView3D model={model} inPit={s.inPitDense} gradeMax={gradeMax} mode={mode3d} present={present} />
          </Suspense>
          <div className="pf-kpis">
            <Kpi label={es ? 'valor del pit' : 'pit value'} value={fInt(s.pitValue)} />
            <Kpi label={es ? 'bloques en pit' : 'blocks in pit'} value={`${fInt(s.nInPit)} / ${fInt(rc.nBlocks)}`} />
            {pitTonnes !== null && <Kpi label={es ? 'toneladas en pit' : 'tonnes in pit'} value={fInt(pitTonnes)} />}
            <Kpi label={es ? 'vs publicado' : 'vs published'} value={s.matchPublished ? '✓' : '✗'} />
          </div>
          <p className="pf-cap">{matchChip} · {es ? 'resuelto en' : 'solved in'} {s.solveMs.toFixed(0)} ms ({es ? 'descarga' : 'fetch'} {s.fetchMs.toFixed(0)} ms)</p>
        </div>
      ),
    },
    {
      id: 'section', label: es ? 'Sección' : 'Section',
      content: (
        <div className="pf-vizstack">
          <div className="pf-plot-t">{es
            ? `Sección vertical en la fila Y=${iy} (${gradeAvailable ? 'ley publicada' : 'valor neto'} · pit delineado · celdas vacías = sin bloque)`
            : `Vertical section at row Y=${iy} (${gradeAvailable ? 'published grade' : 'net value'} · pit outlined · empty cells = no block)`}</div>
          <SectionView nx={dims.nx} nz={dims.nz} cell={cell} />
          <label className="pf-ctl">{es ? 'fila Y' : 'row Y'}: {iy}
            <input className="range" type="range" min={0} max={dims.ny - 1} value={iy} onChange={(e) => setIy(+e.target.value)} />
          </label>
        </div>
      ),
    },
    {
      id: 'summary', label: es ? 'Resumen' : 'Summary',
      content: (
        <div className="pf-vizstack">
          <div className="pf-kpis">
            <Kpi label={es ? 'valor del pit (exacto)' : 'pit value (exact)'} value={fInt(s.pitValue)} />
            <Kpi label={es ? 'óptimo publicado' : 'published optimum'} value={fInt(s.publishedOptimum)} />
            <Kpi label={es ? 'bloques en pit' : 'blocks in pit'} value={`${fInt(s.nInPit)} / ${fInt(rc.nBlocks)}`} />
            <Kpi label={es ? 'identidad maxflow' : 'maxflow identity'} value={Math.abs(s.pitValue - (s.sumPositive - s.maxflow)) < 1 ? '✓' : '✗'} />
            {pitTonnes !== null && <Kpi label={es ? 'toneladas en pit' : 'tonnes in pit'} value={fInt(pitTonnes)} />}
            <Kpi label={es ? 'tiempo de solve' : 'solve time'} value={`${s.solveMs.toFixed(0)} ms`} />
          </div>
          <p className="pf-note">{matchChip}.</p>
          <p className="pf-note">{es
            ? 'Instancia publicada: valores netos (.upit) + precedencia explícita (.prec) resueltos por el MISMO motor min-cut exacto del modo sintético (solveUpitExplicit). Whittle/pushbacks requieren el barrido de RF, que exige descomponer la economía por instancia — fuera del modo real v1, documentado.'
            : 'Published instance: net values (.upit) + explicit precedence (.prec) solved by the SAME exact min-cut engine as the synthetic mode (solveUpitExplicit). Whittle/pushbacks need the RF sweep, which needs a per-instance econ decomposition — out of real-mode v1, documented.'}</p>
        </div>
      ),
    },
    {
      id: 'hist', label: es ? 'Valor bloque' : 'Block value',
      content: (
        <div className="pf-vizstack">
          <div className="pf-plot-t">{es ? 'Histograma del valor neto publicado por bloque (.upit) — negativos = lastre' : 'Published per-block net value histogram (.upit) — negatives = waste'}</div>
          <BarMini values={hist.bins} labels={hist.bins.map(() => '')} unit=""
                   caption={`${fInt(hist.lo)} … ${fInt(hist.hi)}`} />
        </div>
      ),
    },
    ...(gt ? [{
      id: 'gt', label: es ? 'Ley–tonelaje' : 'Grade–tonnage',
      content: (
        <div className="pf-vizstack">
          <div className="pf-plot-t">{es
            ? 'Curva ley–tonelaje de las columnas publicadas (unidades de la instancia)'
            : 'Grade–tonnage curve from the published columns (instance units)'}</div>
          <BarMini values={gt.map((g) => g.tonnes / 1e6)} labels={gt.map((g) => g.cut.toFixed(3))} unit="Mt" />
        </div>
      ),
    }] : []),
  ];

  return (
    <div className="pf-vizstack">
      <Tabs tabs={tabs} ariaLabel={es ? 'vistas del pit (instancia real)' : 'pit views (real instance)'} />
      {!tonnageAvailable && <p className="pf-cap pf-muted">{es
        ? 'Esta instancia no publica tonelaje por bloque; los KPIs de masa no aplican.'
        : 'This instance does not publish per-block tonnage; mass KPIs do not apply.'}</p>}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="pf-kpi"><div className="pf-kpi-v">{value}</div><div className="pf-kpi-l">{label}</div></div>;
}
