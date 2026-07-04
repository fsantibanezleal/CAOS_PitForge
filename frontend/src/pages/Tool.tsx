import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Tabs, useShellLang } from '@fasl-work/caos-app-shell';
import { CASES, caseModel, type PitCase } from '../opt/cases.ts';
import { blockValue, defaultRevenueFactors, isOre, nestedPitShells, solveUltimatePit } from '../opt/index.ts';
import { idx, type EconParams } from '../opt/types.ts';
import { SectionView, type SectionCell } from '../viz/SectionView.tsx';
import { WhittleChart } from '../viz/WhittleChart.tsx';
import { Gauge } from '../viz/Gauge.tsx';
import { shellColor, viridisCss } from '../viz/colormap.ts';
import { REAL_CASES, type RealCase } from '../opt/realCases.ts';
import { RealCasePanel } from '../viz/RealCasePanel.tsx';
import { BarMini } from '../viz/BarMini.tsx';
import { UploadPanel } from '../viz/UploadPanel.tsx';
import { InfillPanel } from '../viz/InfillPanel.tsx';
import { LearnedPanel } from '../viz/LearnedPanel.tsx';
import type { UserModel } from '../lib/contractLive.ts';

const PitView3D = lazy(() => import('../viz/PitView3D.tsx').then((m) => ({ default: m.PitView3D })));
const RFS = defaultRevenueFactors(12);
const fM = (v: number) => `${(v / 1e6).toFixed(1)}`;
const fMt = (v: number) => `${(v / 1e6).toFixed(2)}`;

// Case categories as sidebar TABS (one group visible at a time — the stacked chip rows read as
// clutter). Short bilingual labels; the full category phrase stays as the tooltip.
const CAT_TABS = [
  { cat: 'deposit archetype (the orebody shape)', en: 'archetype', es: 'arquetipo' },
  { cat: 'economic scenario (the price/cost regime)', en: 'economics', es: 'economía' },
  { cat: 'slope / geotech (the wall angle)', en: 'slope', es: 'talud' },
  { cat: 'oracle control (closed-form check)', en: 'oracle', es: 'oráculo' },
];

export default function Tool() {
  const lang = useShellLang();
  const es = lang === 'es';
  // FIRST-LEVEL source decision (Faena pattern): synthetic seeded deposits vs a real published
  // block model. In real mode you only pick WHICH instance; the scenario knobs are locked because
  // the instance publishes explicit precedence + net values (re-deriving them would break
  // comparability with the published optimum).
  const [source, setSource] = useState<'synthetic' | 'real'>('synthetic');
  const [caseId, setCaseId] = useState('A01');
  const [realId, setRealId] = useState(REAL_CASES[0].id);
  const [priceMul, setPriceMul] = useState(1);
  const [slope, setSlope] = useState<number | null>(null); // null → case default
  const [rf, setRf] = useState(1);
  const [bench, setBench] = useState<number | null>(null);
  const [mode3d, setMode3d] = useState<'pit' | 'grade' | 'shells'>('pit');
  const [catTab, setCatTab] = useState(0); // which case-category tab is open in the sidebar
  const real = source === 'real';
  const realCase = useMemo<RealCase>(() => REAL_CASES.find((r) => r.id === realId) ?? REAL_CASES[0], [realId]);
  // CONTRACT-1 upload: when set, the WHOLE App re-solves on the user's model (Controls econ applies).
  const [userModel, setUserModel] = useState<UserModel | null>(null);

  const theCase = useMemo<PitCase>(() => CASES.find((c) => c.id === caseId) ?? CASES[0], [caseId]);
  const model = useMemo(() => (userModel ? userModel.model : caseModel(theCase)), [userModel, theCase]);
  const present = userModel?.present ?? null;
  const gradeMax = useMemo(() => Math.max(...model.grade), [model]);
  const slopeDeg = slope ?? theCase.econ.slopeAngleDeg;

  // economics with the live overrides (price multiplier + slope); RF scales revenue separately.
  const econNoRF: EconParams = useMemo(
    () => ({ ...theCase.econ, price: theCase.econ.price * priceMul, slopeAngleDeg: slopeDeg }),
    [theCase, priceMul, slopeDeg],
  );
  // the heavy nested-shell solve (12 UPLs) — recompute only when the case/price/slope change, not on RF.
  const shells = useMemo(() => nestedPitShells(model, econNoRF, RFS), [model, econNoRF]);
  // the live pit at the current RF — one fast UPL on every slider move.
  const pit = useMemo(() => solveUltimatePit(model, { ...econNoRF, revenueFactor: rf }), [model, econNoRF, rf]);

  const iy = bench ?? Math.floor(model.dims.ny / 2);

  useEffect(() => { setBench(null); setRf(1); }, [caseId]);
  useEffect(() => { setBench(null); setRf(1); setPriceMul(1); setSlope(null); setUserModel(null); }, [source]);
  // keep the open category tab in sync with the ACTIVE case (case switches, source resets)
  useEffect(() => {
    const k = CAT_TABS.findIndex((t) => t.cat === theCase.category);
    if (k >= 0) setCatTab(k);
  }, [theCase]);
  useEffect(() => { setBench(null); }, [userModel]);

  // ---- section cell builders ------------------------------------------------------------------------------
  const cellGrade = (ix: number, iz: number): SectionCell => {
    const i = idx(model.dims, ix, iy, iz);
    if (present && !present[i]) return { color: null, inPit: false, label: `(${ix},${iz}) · no block` };
    const g = model.grade[i];
    return {
      color: viridisCss(Math.min(1, g / (gradeMax || 1))),
      inPit: !!pit.inPit[i],
      label: `(${ix},${iz}) · ${(g * 100).toFixed(2)} % · ${pit.inPit[i] ? (isOre(model, i, econNoRF) ? 'ore (in pit)' : 'waste (in pit)') : 'not mined'}`,
    };
  };
  const cellShell = (ix: number, iz: number): SectionCell => {
    const i = idx(model.dims, ix, iy, iz);
    if (present && !present[i]) return { color: null, inPit: false, label: `(${ix},${iz}) · no block` };
    const s = shells.shellOf[i];
    return {
      color: s < 0 ? null : shellColor(s, RFS.length),
      inPit: false,
      label: s < 0 ? `(${ix},${iz}) · never mined` : `(${ix},${iz}) · RF shell ${s + 1}/${RFS.length} (RF ${RFS[s]})`,
    };
  };

  // ---- grade–tonnage curve (classic mine-planning curve) --------------------------------------------------
  const gradeTonnage = useMemo(() => {
    const cutoffs = Array.from({ length: 24 }, (_, k) => (k / 23) * gradeMax);
    return cutoffs.map((cut) => {
      let t = 0;
      let gm = 0;
      for (let i = 0; i < model.grade.length; i++) {
        if (present && !present[i]) continue;
        if (model.grade[i] >= cut) { t += model.tonnage[i]; gm += model.grade[i] * model.tonnage[i]; }
      }
      return { cut, tonnes: t, meanGrade: t > 0 ? gm / t : 0 };
    });
  }, [model, gradeMax, present]);

  // ---- block-value histogram ------------------------------------------------------------------------------
  const valueHist = useMemo(() => {
    const vals: number[] = [];
    for (let i = 0; i < model.grade.length; i++) {
      if (present && !present[i]) continue;
      vals.push(blockValue(model, i, { ...econNoRF, revenueFactor: rf }));
    }
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const nb = 28;
    const bins = new Array(nb).fill(0);
    for (const v of vals) bins[Math.min(nb - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo || 1)) * nb)))]++;
    return { bins, lo, hi };
  }, [model, econNoRF, rf, present]);

  const stripZones = [
    { upTo: 1, color: '#3fb95066', label: es ? 'bajo' : 'low' },
    { upTo: 3, color: '#d2992266', label: es ? 'medio' : 'mid' },
    { upTo: 8, color: '#f8514966', label: es ? 'alto' : 'high' },
  ];

  // ---- tabs -----------------------------------------------------------------------------------------------
  const tabs = [
    {
      id: 'pit3d', label: es ? '3D · pit' : '3D · pit',
      content: (
        <div className="pf-vizstack">
          <div className="pf-plot-th">
            <div className="pf-plot-t">{es ? 'Pit último — voxels extraídos; orbita para rotar' : 'Ultimate pit — extracted voxels; orbit to rotate'}</div>
            <div className="pf-seg">
              {(['pit', 'grade', 'shells'] as const).map((m) => (
                <button key={m} className={`chip ${mode3d === m ? 'on' : ''}`} onClick={() => setMode3d(m)}>
                  {m === 'pit' ? (es ? 'solo pit' : 'pit only') : m === 'grade' ? (es ? 'orebody' : 'orebody') : (es ? 'shells' : 'shells')}
                </button>
              ))}
            </div>
          </div>
          <Suspense fallback={<div className="pf-plot" style={{ height: 360 }}>{es ? 'cargando 3D…' : 'loading 3D…'}</div>}>
            <PitView3D model={model} inPit={pit.inPit} gradeMax={gradeMax} mode={mode3d}
                       shellOf={shells.shellOf} nShells={RFS.length} present={present ?? undefined} />
          </Suspense>
          <div className="pf-kpis">
            <Kpi label={es ? 'valor del pit' : 'pit value'} value={`$${fM(pit.pitValue)} M`} />
            <Kpi label={es ? 'bloques' : 'blocks'} value={`${pit.nBlocks}`} />
            <Kpi label="strip" value={pit.stripRatio.toFixed(2)} />
            <Kpi label={es ? 'mineral' : 'ore'} value={`${fMt(pit.oreTonnes)} Mt`} />
          </div>
        </div>
      ),
    },
    {
      id: 'section', label: es ? 'Sección' : 'Section',
      content: (
        <div className="pf-vizstack">
          <div className="pf-plot-t">{es ? `Sección vertical en la fila Y=${iy} (ley · pit delineado)` : `Vertical section at row Y=${iy} (grade · pit outlined)`}</div>
          <SectionView nx={model.dims.nx} nz={model.dims.nz} cell={cellGrade} />
          <label className="pf-ctl">{es ? 'fila Y' : 'row Y'}: {iy}
            <input className="range" type="range" min={0} max={model.dims.ny - 1} value={iy}
                   onChange={(e) => setBench(+e.target.value)} />
          </label>
        </div>
      ),
    },
    {
      id: 'whittle', label: es ? 'Curvas Whittle' : 'Whittle curves',
      content: (
        <div className="pf-vizstack">
          <div className="pf-plot-t">{es ? 'Pit anidado por factor de ingreso (RF) — valor + tonelaje; click para fijar RF' : 'Nested pits by revenue factor (RF) — value + tonnage; click to set RF'}</div>
          <WhittleChart curve={shells.curve} currentRF={rf} onPickRF={setRf} />
          <div className="pf-cap">{es ? `RF = ${rf.toFixed(2)} · valor $${fM(pit.pitValue)} M · ${pit.nBlocks} bloques` : `RF = ${rf.toFixed(2)} · value $${fM(pit.pitValue)} M · ${pit.nBlocks} blocks`}</div>
        </div>
      ),
    },
    {
      id: 'pushback', label: es ? 'Shells' : 'Shells',
      content: (
        <div className="pf-vizstack">
          <div className="pf-plot-t">{es ? `Shells de RF anidados en la sección Y=${iy} — guía de pushbacks (shells crudos, sin agrupar ni chequear ancho mínimo de minado)` : `Nested RF shells on section Y=${iy} — a pushback guide (raw shells, not grouped or width-checked)`}</div>
          <SectionView nx={model.dims.nx} nz={model.dims.nz} cell={cellShell} />
          <div className="pf-legend">
            {RFS.map((r, k) => <span key={k}><i style={{ background: shellColor(k, RFS.length) }} /> {k + 1} (RF {r})</span>)}
          </div>
        </div>
      ),
    },
    {
      id: 'summary', label: es ? 'Resumen' : 'Summary',
      content: (
        <div className="pf-vizstack">
          <Gauge title={es ? 'razón de descapote (waste:ore)' : 'strip ratio (waste:ore)'} value={pit.stripRatio} max={8} zones={stripZones} fmt={(v) => v.toFixed(2)} />
          <div className="pf-kpis">
            <Kpi label={es ? 'valor del pit' : 'pit value'} value={`$${fM(pit.pitValue)} M`} />
            <Kpi label={es ? 'mineral' : 'ore'} value={`${fMt(pit.oreTonnes)} Mt`} />
            <Kpi label={es ? 'lastre' : 'waste'} value={`${fMt(pit.wasteTonnes)} Mt`} />
            <Kpi label={es ? 'metal recuperable' : 'recoverable metal'} value={`${(pit.metalTonnes / 1e3).toFixed(1)} kt`} />
            <Kpi label={es ? 'bloques en pit' : 'blocks in pit'} value={`${pit.nBlocks}`} />
            <Kpi label={es ? 'identidad maxflow' : 'maxflow identity'} value={Math.abs(pit.pitValue - (pit.sumPositive - pit.maxflow)) < 1 ? '✓' : '✗'} />
          </div>
          <p className="pf-note">{es
            ? `El valor del pit es exacto: Σ valores positivos − flujo máximo (min-cut). ${userModel ? 'Modelo de bloques subido por el usuario.' : 'Depósitos sintéticos.'}`
            : `The pit value is exact: Σ positive values − max-flow (min-cut). ${userModel ? 'User-uploaded block model.' : 'Synthetic deposits.'}`}</p>
        </div>
      ),
    },
    {
      id: 'gt', label: es ? 'Ley–tonelaje' : 'Grade–tonnage',
      content: (
        <div className="pf-vizstack">
          <div className="pf-plot-t">{es ? 'Curva ley–tonelaje del modelo (tonelaje sobre ley de corte)' : 'Model grade–tonnage curve (tonnage above cutoff)'}</div>
          <BarMini values={gradeTonnage.map((g) => g.tonnes / 1e6)}
                   labels={gradeTonnage.map((g) => `${(g.cut * 100).toFixed(1)}%`)} unit="Mt" />
        </div>
      ),
    },
    {
      id: 'hist', label: es ? 'Valor bloque' : 'Block value',
      content: (
        <div className="pf-vizstack">
          <div className="pf-plot-t">{es ? `Histograma del valor de bloque (RF ${rf.toFixed(2)}) — negativos = lastre` : `Block-value histogram (RF ${rf.toFixed(2)}) — negatives = waste`}</div>
          <BarMini values={valueHist.bins} labels={valueHist.bins.map(() => '')}
                   unit="" caption={`$${fM(valueHist.lo)}M … $${fM(valueHist.hi)}M`} />
        </div>
      ),
    },
    {
      id: 'infill', label: es ? 'Infill · what-if' : 'Infill · what-if',
      content: <InfillPanel model={model} econ={econNoRF} rf={rf} iy={iy} present={present} es={es} />,
    },
    {
      id: 'surrogate', label: es ? 'Surrogate · preview' : 'Surrogate · preview',
      content: <LearnedPanel model={model} econ={econNoRF} iy={iy} es={es} />,
    },
    {
      id: 'byo', label: es ? 'Tu modelo' : 'Bring your own',
      content: <UploadPanel es={es} active={!!userModel} onUse={setUserModel} onClear={() => setUserModel(null)} />,
    },
  ];

  // in real mode the scenario/econ knobs are LOCKED: the instance publishes explicit precedence
  // (.prec) + net block values (.upit); regenerating either breaks published-optimum comparability.
  const lockTip = es
    ? 'deshabilitado en modo real: la instancia publica valores netos y precedencia explícita; recalcular rompería la comparabilidad con el óptimo publicado'
    : 'disabled in real mode: the instance publishes net values and explicit precedence; re-deriving them would break comparability with the published optimum';

  return (
    <div className="page-body pf-layout">
      <aside className="pf-side">
        <div className="pf-card">
          <div className="pf-card-t">{es ? 'Fuente' : 'Source'}</div>
          <div className="pf-chips">
            <button className={`chip ${!real ? 'on' : ''}`} onClick={() => setSource('synthetic')}>
              {es ? 'sintético (semilla)' : 'synthetic (seeded)'}
            </button>
            <button className={`chip ${real ? 'on' : ''}`} onClick={() => setSource('real')}>
              {es ? 'real · MineLib' : 'real · MineLib'}
            </button>
          </div>
          <div className="pf-cap pf-muted">{real
            ? (es ? 'block models publicados; sólo eliges la instancia' : 'published block models; you only pick the instance')
            : (es ? 'depósitos generados con semilla + oráculo CTRL' : 'seeded generated deposits + the CTRL oracle')}</div>
        </div>

        <div className="pf-card">
          <div className="pf-card-t">{real ? (es ? 'Instancia' : 'Instance') : (es ? 'Caso' : 'Case')}</div>
          {real ? (
            <>
              {/* #34: split the picker so published MineLib instances and our own oreblocks twins
                  read as distinct provenances (one licensed-remote, one synthetic-committed). */}
              <div className="pf-catgroup">
                <div className="pf-catlabel">{es ? 'publicadas · MineLib' : 'published · MineLib'}</div>
                <div className="pf-chips">
                  {REAL_CASES.filter((r) => !r.synthetic).map((r) => (
                    <button key={r.id} className={`chip ${realId === r.id ? 'on' : ''}`} title={r.name}
                            onClick={() => setRealId(r.id)}>{r.id}</button>
                  ))}
                </div>
              </div>
              <div className="pf-catgroup">
                <div className="pf-catlabel">{es ? 'gemelos sintéticos · oreblocks' : 'synthetic twins · oreblocks'}</div>
                <div className="pf-chips">
                  {REAL_CASES.filter((r) => r.synthetic).map((r) => (
                    <button key={r.id} className={`chip ${realId === r.id ? 'on' : ''}`} title={r.name}
                            onClick={() => setRealId(r.id)}>{r.id.replace('twin-', '')}</button>
                  ))}
                </div>
              </div>
              <div className="pf-cap">{realCase.name}</div>
              <div className="pf-cap pf-muted">{es ? realCase.provenance_es : realCase.provenance_en}</div>
            </>
          ) : (
            <>
              <div className="pf-seg pf-cattabs" role="tablist" aria-label={es ? 'categorías de caso' : 'case categories'}>
                {CAT_TABS.map((t, k) => {
                  const holdsActive = !userModel && theCase.category === t.cat;
                  return (
                    <button key={t.cat} role="tab" aria-selected={catTab === k}
                            className={`chip ${catTab === k ? 'on' : ''}`} title={t.cat}
                            onClick={() => setCatTab(k)}>
                      {es ? t.es : t.en}{holdsActive ? ' •' : ''}
                    </button>
                  );
                })}
              </div>
              <div className="pf-chips">
                {CASES.filter((c) => c.category === CAT_TABS[catTab].cat).map((c) => (
                  <button key={c.id} className={`chip ${!userModel && caseId === c.id ? 'on' : ''}`} title={c.name}
                          onClick={() => { setUserModel(null); setCaseId(c.id); }}>{c.id}</button>
                ))}
              </div>
              {userModel ? (
                <>
                  <div className="pf-cap"><b>{es ? 'tu modelo' : 'your model'}</b> · {model.meta.name} · {userModel.dims.nx}×{userModel.dims.ny}×{userModel.dims.nz} · {userModel.nRows} {es ? 'bloques' : 'blocks'}</div>
                  <div className="pf-cap pf-muted">{es ? 'todos los tabs resuelven sobre él (economía de Controles); elige un caso para volver' : 'every tab solves on it (Controls econ); pick a case to go back'}</div>
                </>
              ) : (
                <>
                  <div className="pf-cap">{theCase.name}</div>
                  <div className="pf-cap pf-muted">{es ? theCase.expectedBand : theCase.expectedBand}</div>
                </>
              )}
            </>
          )}
        </div>

        <div className="pf-card">
          <div className="pf-card-t">{es ? 'Controles (recálculo en vivo)' : 'Controls (live re-solve)'}</div>
          <label className={`pf-ctl ${real ? 'off' : ''}`} title={real ? lockTip : undefined}>
            {es ? 'factor de ingreso RF' : 'revenue factor RF'}: {rf.toFixed(2)}
            <input className="range" type="range" min={0.1} max={1} step={0.05} value={rf} disabled={real}
                   onChange={(e) => setRf(+e.target.value)} />
          </label>
          <label className={`pf-ctl ${real ? 'off' : ''}`} title={real ? lockTip : undefined}>
            {es ? 'precio ×' : 'price ×'}: {priceMul.toFixed(2)}{real ? '' : ` ($${(theCase.econ.price * priceMul).toFixed(0)}/t)`}
            <input className="range" type="range" min={0.3} max={2} step={0.05} value={priceMul} disabled={real}
                   onChange={(e) => setPriceMul(+e.target.value)} />
          </label>
          <label className={`pf-ctl ${real ? 'off' : ''}`} title={real ? lockTip : undefined}>
            {es ? 'talud°' : 'slope°'}: {real ? (es ? 'de la instancia' : 'from the instance') : slopeDeg}
            <input className="range" type="range" min={18} max={75} step={1} value={slopeDeg} disabled={real}
                   onChange={(e) => setSlope(+e.target.value)} />
          </label>
          {real
            ? <p className="pf-cap pf-muted">{es ? 'bloqueados: la instancia trae precedencia y valores publicados' : 'locked: the instance ships published precedence and values'}</p>
            : <button className="chip" onClick={() => { setPriceMul(1); setSlope(null); setRf(1); }}>{es ? 'reset' : 'reset'}</button>}
        </div>
      </aside>

      <main className="pf-main">
        {real
          ? <RealCasePanel rc={realCase} es={es} />
          : <Tabs tabs={tabs} ariaLabel={es ? 'vistas del pit' : 'pit views'} />}
      </main>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="pf-kpi"><div className="pf-kpi-v">{value}</div><div className="pf-kpi-l">{label}</div></div>;
}
