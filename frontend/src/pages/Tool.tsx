import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Tabs, useShellLang } from '@fasl-work/caos-app-shell';
import { CASES, caseModel, type PitCase } from '../opt/cases.ts';
import { blockValue, defaultRevenueFactors, isOre, nestedPitShells, solveUltimatePit } from '../opt/index.ts';
import { idx, type EconParams } from '../opt/types.ts';
import { SectionView, type SectionCell } from '../viz/SectionView.tsx';
import { WhittleChart } from '../viz/WhittleChart.tsx';
import { Gauge } from '../viz/Gauge.tsx';
import { shellColor, viridisCss } from '../viz/colormap.ts';
import { loadManifest } from '../lib/artifacts.ts';
import { LearnedPanel } from '../viz/LearnedPanel.tsx';
import type { CaseManifest } from '../lib/contract.types.ts';

const PitView3D = lazy(() => import('../viz/PitView3D.tsx').then((m) => ({ default: m.PitView3D })));
const RFS = defaultRevenueFactors(12);
const fM = (v: number) => `${(v / 1e6).toFixed(1)}`;
const fMt = (v: number) => `${(v / 1e6).toFixed(2)}`;

const CATS = [
  'deposit archetype (the orebody shape)',
  'economic scenario (the price/cost regime)',
  'slope / geotech (the wall angle)',
  'oracle control (closed-form check)',
];

export default function Tool() {
  const lang = useShellLang();
  const es = lang === 'es';
  const [caseId, setCaseId] = useState('A01');
  const [priceMul, setPriceMul] = useState(1);
  const [slope, setSlope] = useState<number | null>(null); // null → case default
  const [rf, setRf] = useState(1);
  const [bench, setBench] = useState<number | null>(null);
  const [mode3d, setMode3d] = useState<'pit' | 'grade' | 'shells'>('pit');
  const [manifest, setManifest] = useState<CaseManifest | null>(null);

  const theCase = useMemo<PitCase>(() => CASES.find((c) => c.id === caseId) ?? CASES[0], [caseId]);
  const model = useMemo(() => caseModel(theCase), [theCase]);
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
  useEffect(() => { loadManifest(caseId).then(setManifest).catch(() => setManifest(null)); }, [caseId]);

  // ---- section cell builders ------------------------------------------------------------------------------
  const cellGrade = (ix: number, iz: number): SectionCell => {
    const i = idx(model.dims, ix, iy, iz);
    const g = model.grade[i];
    return {
      color: viridisCss(Math.min(1, g / (gradeMax || 1))),
      inPit: !!pit.inPit[i],
      label: `(${ix},${iz}) · ${(g * 100).toFixed(2)} % · ${pit.inPit[i] ? (isOre(model, i, econNoRF) ? 'ore (in pit)' : 'waste (in pit)') : 'not mined'}`,
    };
  };
  const cellShell = (ix: number, iz: number): SectionCell => {
    const i = idx(model.dims, ix, iy, iz);
    const s = shells.shellOf[i];
    return {
      color: s < 0 ? null : shellColor(s, RFS.length),
      inPit: false,
      label: s < 0 ? `(${ix},${iz}) · never mined` : `(${ix},${iz}) · pushback shell ${s + 1}/${RFS.length} (RF ${RFS[s]})`,
    };
  };

  // ---- grade–tonnage curve (classic mine-planning curve) --------------------------------------------------
  const gradeTonnage = useMemo(() => {
    const cutoffs = Array.from({ length: 24 }, (_, k) => (k / 23) * gradeMax);
    return cutoffs.map((cut) => {
      let t = 0;
      let gm = 0;
      for (let i = 0; i < model.grade.length; i++) {
        if (model.grade[i] >= cut) { t += model.tonnage[i]; gm += model.grade[i] * model.tonnage[i]; }
      }
      return { cut, tonnes: t, meanGrade: t > 0 ? gm / t : 0 };
    });
  }, [model, gradeMax]);

  // ---- block-value histogram ------------------------------------------------------------------------------
  const valueHist = useMemo(() => {
    const vals: number[] = [];
    for (let i = 0; i < model.grade.length; i++) vals.push(blockValue(model, i, { ...econNoRF, revenueFactor: rf }));
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const nb = 28;
    const bins = new Array(nb).fill(0);
    for (const v of vals) bins[Math.min(nb - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo || 1)) * nb)))]++;
    return { bins, lo, hi };
  }, [model, econNoRF, rf]);

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
                  {m === 'pit' ? (es ? 'solo pit' : 'pit only') : m === 'grade' ? (es ? 'orebody' : 'orebody') : (es ? 'pushbacks' : 'pushbacks')}
                </button>
              ))}
            </div>
          </div>
          <Suspense fallback={<div className="pf-plot" style={{ height: 360 }}>{es ? 'cargando 3D…' : 'loading 3D…'}</div>}>
            <PitView3D model={model} inPit={pit.inPit} gradeMax={gradeMax} mode={mode3d}
                       shellOf={shells.shellOf} nShells={RFS.length} />
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
      id: 'pushback', label: es ? 'Pushbacks' : 'Pushbacks',
      content: (
        <div className="pf-vizstack">
          <div className="pf-plot-t">{es ? `Fases (pushbacks) en la sección Y=${iy} — el orden de minado por shell` : `Phases (pushbacks) on section Y=${iy} — the mining order by shell`}</div>
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
            ? 'El valor del pit es exacto: Σ valores positivos − flujo máximo (min-cut). Depósitos sintéticos.'
            : 'The pit value is exact: Σ positive values − max-flow (min-cut). Synthetic deposits.'}</p>
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
      id: 'learned', label: es ? 'Modelos aprendidos' : 'Learned models',
      content: <LearnedPanel model={model} econ={econNoRF} iy={iy} es={es} />,
    },
    {
      id: 'contract', label: es ? 'Contrato · gate' : 'Contract · gate',
      content: (
        <div className="pf-vizstack">
          {manifest ? (
            <>
              <div className="pf-kpis">
                <Kpi label="lane" value={manifest.lane} />
                <Kpi label={es ? 'runtimes' : 'runtimes'} value={manifest.gate.runtimes.join(', ')} />
                <Kpi label={es ? 'bytes traza' : 'trace bytes'} value={`${manifest.gate.trace_bytes}`} />
              </div>
              {manifest.flags.length > 0 && <p className="pf-note">⚑ {JSON.stringify(manifest.flags)}</p>}
              <p className="pf-note">{manifest.honesty}</p>
            </>
          ) : <p className="pf-note">{es ? 'cargando manifiesto…' : 'loading manifest…'}</p>}
        </div>
      ),
    },
    {
      id: 'byo', label: es ? 'Tu modelo' : 'Bring your own',
      content: (
        <div className="pf-vizstack">
          <p className="pf-note">{es
            ? 'PitForge abre TU modelo de bloques, no solo los casos horneados. CONTRATO 1 (data/examples/blockmodel.csv) valida una tabla de bloques {ix,iy,iz,tonnage,density,grade}: rechaza tonelaje/densidad negativos, índices fuera de la caja y leyes no físicas; marca leyes implausibles y duplicados.'
            : 'PitForge opens YOUR block model, not just the baked cases. CONTRACT 1 (data/examples/blockmodel.csv) validates a block table {ix,iy,iz,tonnage,density,grade}: it rejects negative tonnage/density, out-of-box indices and unphysical grades; it flags implausible grades and duplicates.'}</p>
          <p className="pf-cap">{es ? 'El esquema completo está en docs/ y data/README.md.' : 'The full schema is in docs/ and data/README.md.'}</p>
        </div>
      ),
    },
    {
      id: 'raw', label: es ? 'Traza' : 'Trace',
      content: (
        <pre className="codeblock" style={{ maxHeight: 360 }}>{JSON.stringify({
          case: theCase.id, archetype: theCase.archetype, dims: model.dims,
          econ: { ...econNoRF, revenueFactor: rf },
          ultimate: { pitValue: pit.pitValue, oreTonnes: pit.oreTonnes, wasteTonnes: pit.wasteTonnes, stripRatio: pit.stripRatio, nBlocks: pit.nBlocks },
        }, null, 2)}</pre>
      ),
    },
  ];

  return (
    <div className="page-body pf-layout">
      <aside className="pf-side">
        <div className="pf-card">
          <div className="pf-card-t">{es ? 'Caso' : 'Case'}</div>
          {CATS.map((cat) => (
            <div key={cat} className="pf-catgroup">
              <div className="pf-catlabel">{cat.split(' (')[0]}</div>
              <div className="pf-chips">
                {CASES.filter((c) => c.category === cat).map((c) => (
                  <button key={c.id} className={`chip ${caseId === c.id ? 'on' : ''}`} title={c.name}
                          onClick={() => setCaseId(c.id)}>{c.id}</button>
                ))}
              </div>
            </div>
          ))}
          <div className="pf-cap">{theCase.name}</div>
          <div className="pf-cap pf-muted">{es ? theCase.expectedBand : theCase.expectedBand}</div>
        </div>

        <div className="pf-card">
          <div className="pf-card-t">{es ? 'Controles (recálculo en vivo)' : 'Controls (live re-solve)'}</div>
          <label className="pf-ctl">{es ? 'factor de ingreso RF' : 'revenue factor RF'}: {rf.toFixed(2)}
            <input className="range" type="range" min={0.1} max={1} step={0.05} value={rf} onChange={(e) => setRf(+e.target.value)} />
          </label>
          <label className="pf-ctl">{es ? 'precio ×' : 'price ×'}: {priceMul.toFixed(2)} (${(theCase.econ.price * priceMul).toFixed(0)}/t)
            <input className="range" type="range" min={0.3} max={2} step={0.05} value={priceMul} onChange={(e) => setPriceMul(+e.target.value)} />
          </label>
          <label className="pf-ctl">{es ? 'talud°' : 'slope°'}: {slopeDeg}
            <input className="range" type="range" min={18} max={75} step={1} value={slopeDeg} onChange={(e) => setSlope(+e.target.value)} />
          </label>
          <button className="chip" onClick={() => { setPriceMul(1); setSlope(null); setRf(1); }}>{es ? 'reset' : 'reset'}</button>
        </div>
      </aside>

      <main className="pf-main">
        <Tabs tabs={tabs} ariaLabel={es ? 'vistas del pit' : 'pit views'} />
      </main>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="pf-kpi"><div className="pf-kpi-v">{value}</div><div className="pf-kpi-l">{label}</div></div>;
}

/** A tiny inline bar chart (no extra deps) for the grade–tonnage + histogram readouts. */
function BarMini({ values, labels, unit, caption }: { values: number[]; labels: string[]; unit: string; caption?: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="pf-bars">
      <div className="pf-bars-row">
        {values.map((v, i) => (
          <div key={i} className="pf-bar" title={`${labels[i]} ${v.toFixed(2)} ${unit}`}>
            <i style={{ height: `${(v / max) * 100}%` }} />
          </div>
        ))}
      </div>
      {caption && <div className="pf-cap">{caption}</div>}
    </div>
  );
}
