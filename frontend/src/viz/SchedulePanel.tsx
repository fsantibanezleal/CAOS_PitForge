import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { greedySchedule } from '../opt/index.ts';
import { idx, type BlockModel, type EconParams } from '../opt/types.ts';
import { SectionView, type SectionCell } from './SectionView.tsx';
import { viridisCss } from './colormap.ts';
import { type CpitCase, type CpitScheduleFile, loadCpitSchedule } from '../lib/artifacts.ts';

// The CPIT scheduling tab: the ultimate pit the App already solves exactly is the undiscounted, uncapacitated
// limit of a schedule. Here we add the scheduling dimension (time, per-period capacity, discounting -> NPV).
// Left/top: a paused-by-default bench-sequence animation of a live greedy pushback on the current deposit.
// Bottom: the certified NPV-vs-period curve, from the offline LP relaxation (data/derived/cpit-schedule.json),
// with the integrality gap shown honestly. The browser cannot solve the LP, so the certified bound is offline;
// the live schedule is a feasible glass-box heuristic. Honesty: the LP relaxation is a bound, not a schedule.

import uPlot from 'uplot';
import { UPlotChart, themeColors } from './UPlotChart.tsx';

const fM = (v: number) => `$${(v / 1e6).toFixed(1)} M`;

/** NPV-vs-period chart, interactive (uPlot Tier-A, issue #51): cumulative-NPV bars with crosshair + live money
 *  readout, the certified LP bound and the undiscounted-UPL reference as dashed flat series, drag-zoom,
 *  theme-aware. Replaces the static SVG. */
function NpvPeriodChart({ cum, bound, upl, es }: { cum: number[]; bound: number; upl?: number; es: boolean }) {
  const n = cum.length;
  const data = useMemo(() => {
    const xs = cum.map((_, i) => i + 1);
    const boundS = xs.map(() => bound);
    const uplS = xs.map(() => (upl !== undefined ? upl : null));
    return [xs, cum, boundS, uplS] as uPlot.AlignedData;
  }, [cum, bound, upl]);
  const build = useCallback((width: number, height: number): uPlot.Options => {
    const c = themeColors();
    const fmt = (v: number | null) => (v == null ? '--' : fM(v));
    return {
      width, height,
      scales: { x: { time: false, range: [0.4, n + 0.6] } },
      axes: [
        { stroke: c.subtle, grid: { show: false }, ticks: { stroke: c.border },
          values: (_u, vs) => vs.map((v) => (v == null || v % 1 !== 0 ? '' : String(v))),
          label: es ? 'periodo' : 'period', labelSize: 12 },
        { stroke: c.subtle, grid: { stroke: c.border }, ticks: { stroke: c.border },
          values: (_u, vs) => vs.map((v) => (v == null ? '' : `$${(v / 1e6).toFixed(0)}M`)) },
      ],
      series: [
        { label: es ? 'periodo' : 'period', value: (_u, v) => (v == null ? '--' : String(v)) },
        { label: es ? 'NPV acumulado' : 'cumulative NPV', stroke: c.accent, fill: c.accent + '55', width: 1,
          paths: uPlot.paths!.bars!({ size: [0.7, 100] }), points: { show: false },
          value: (_u: uPlot, v: number | null) => fmt(v) },
        { label: es ? 'cota certificada (LP)' : 'certified bound (LP)', stroke: c.warn, width: 1.5, dash: [6, 4],
          points: { show: false }, value: (_u: uPlot, v: number | null) => fmt(v) },
        { label: es ? 'pit último (sin descuento)' : 'ultimate pit (undiscounted)', stroke: c.faint, width: 1,
          dash: [2, 3], points: { show: false }, value: (_u: uPlot, v: number | null) => fmt(v) },
      ],
      cursor: { drag: { x: true, y: false } },
      legend: { live: true },
    };
  }, [n, es]);
  return <UPlotChart data={data} build={build} height={230} />;
}

export function SchedulePanel({ model, econ, iy, es }: { model: BlockModel; econ: EconParams; iy: number; es: boolean }) {
  const [periods, setPeriods] = useState(8);
  const [rate, setRate] = useState(0.10);
  const [capFrac, setCapFrac] = useState(1.15);
  const [cursor, setCursor] = useState(8); // reveal periods <= cursor; default = all revealed (paused)
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  const [cert, setCert] = useState<CpitScheduleFile | null>(null);
  const [certErr, setCertErr] = useState(false);
  const [certId, setCertId] = useState('twin-porphyry-s');
  useEffect(() => { loadCpitSchedule().then(setCert).catch(() => setCertErr(true)); }, []);

  const econ1 = useMemo(() => ({ ...econ, revenueFactor: 1 }), [econ]);
  const sched = useMemo(
    () => greedySchedule(model, econ1, { periods, discountRatePerPeriod: rate, capacityFraction: capFrac }),
    [model, econ1, periods, rate, capFrac],
  );

  const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } setPlaying(false); };
  const play = () => {
    stop();
    setCursor(0);
    setPlaying(true);
    let c = 0;
    timer.current = window.setInterval(() => {
      c += 1;
      setCursor(c);
      if (c >= periods) stop();
    }, 700);
  };

  // a knob change resets the view to the full (paused) schedule; never auto-play.
  useEffect(() => { stop(); setCursor(periods); }, [sched, periods]);
  // halt on a hidden tab, and clean up the interval on unmount (no compute-bomb).
  useEffect(() => {
    const onVis = () => { if (document.hidden && timer.current) { clearInterval(timer.current); timer.current = null; setPlaying(false); } };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); if (timer.current) clearInterval(timer.current); };
  }, []);

  const cell = (ix: number, iz: number): SectionCell => {
    const i = idx(model.dims, ix, iy, iz);
    const p = sched.periodOfBlock[i];
    if (p < 0) return { color: null, inPit: false, label: `(${ix},${iz}) · ${es ? 'no minado' : 'not mined'}` };
    const revealed = p <= cursor;
    return {
      color: revealed ? viridisCss(periods > 1 ? p / (periods - 1) : 0) : 'rgba(128,128,128,0.14)',
      inPit: revealed,
      label: `(${ix},${iz}) · ${es ? 'periodo' : 'period'} ${p + 1}${revealed ? '' : es ? ' (pendiente)' : ' (pending)'}`,
    };
  };

  const certCase: CpitCase | undefined = cert?.cases[certId];

  return (
    <div className="pf-vizstack">
      <div className="pf-plot-t">{es
        ? `Secuencia de bancos (pushback) sobre el depósito actual, sección Y=${iy}, coloreada por periodo de extracción. La animación parte pausada y se reproduce una vez.`
        : `Bench (pushback) sequence on the current deposit, section Y=${iy}, coloured by extraction period. The animation starts paused and runs once.`}</div>

      <div className="pf-plot-th">
        <div className="pf-seg">
          <button className="chip" onClick={play} disabled={playing}>{playing ? (es ? 'reproduciendo...' : 'running...') : (es ? '▶ reproducir secuencia' : '▶ play sequence')}</button>
          <button className="chip" onClick={() => { stop(); setCursor(periods); }}>{es ? 'ver completo' : 'show full'}</button>
        </div>
        <div className="pf-cap pf-muted">{es ? `periodo ${Math.min(cursor + 1, periods)} / ${periods}` : `period ${Math.min(cursor + 1, periods)} / ${periods}`}</div>
      </div>

      <SectionView nx={model.dims.nx} nz={model.dims.nz} cell={cell} />
      <div className="pf-legend">
        {Array.from({ length: periods }, (_, k) => (
          <span key={k}><i style={{ background: viridisCss(periods > 1 ? k / (periods - 1) : 0) }} /> {es ? 'p' : 'p'}{k + 1}</span>
        ))}
      </div>

      <div className="pf-kpis">
        <Kpi label={es ? 'pit último (sin descuento)' : 'ultimate pit (undiscounted)'} value={fM(sched.uplValue)} />
        <Kpi label={es ? 'NPV del plan (vivo)' : 'schedule NPV (live)'} value={fM(sched.npv)} />
        <Kpi label={es ? 'pérdida por descuento' : 'discounting loss'} value={`${((1 - sched.npv / (sched.uplValue || 1)) * 100).toFixed(1)}%`} />
        <Kpi label={es ? 'bloques minados' : 'blocks mined'} value={`${sched.minedBlocks}`} />
      </div>

      <div className="pf-card">
        <div className="pf-card-t">{es ? 'Controles del plan (recálculo en vivo)' : 'Schedule controls (live re-solve)'}</div>
        <label className="pf-ctl">{es ? 'periodos' : 'periods'}: {periods}
          <input className="range" type="range" min={2} max={12} step={1} value={periods} onChange={(e) => setPeriods(+e.target.value)} />
        </label>
        <label className="pf-ctl">{es ? 'tasa de descuento / periodo' : 'discount rate / period'}: {(rate * 100).toFixed(0)}%
          <input className="range" type="range" min={0} max={0.3} step={0.01} value={rate} onChange={(e) => setRate(+e.target.value)} />
        </label>
        <label className="pf-ctl">{es ? 'capacidad (x tonelaje/periodo)' : 'capacity (x tonnage/period)'}: {capFrac.toFixed(2)}
          <input className="range" type="range" min={1} max={2.5} step={0.05} value={capFrac} onChange={(e) => setCapFrac(+e.target.value)} />
        </label>
        <p className="pf-cap pf-muted">{es
          ? 'A tasa 0 y capacidad alta el plan mina exactamente el pit último (control de dualidad). Subir la tasa o apretar la capacidad reduce el NPV: eso es la pérdida por diferir.'
          : 'At rate 0 and ample capacity the schedule mines exactly the ultimate pit (the duality control). Raising the rate or tightening capacity lowers the NPV: that is the cost of deferral.'}</p>
      </div>

      <div className="pf-card">
        <div className="pf-card-t">{es ? 'Cota certificada (LP offline) + brecha de integralidad' : 'Certified bound (offline LP) + integrality gap'}</div>
        {certErr || !cert ? (
          <p className="pf-note">{es
            ? 'Artefacto cpit-schedule.json ausente. Ejecutar `.venv-precompute/Scripts/python.exe scripts/gen_cpit.py`.'
            : 'cpit-schedule.json artifact absent. Run `.venv-precompute/Scripts/python.exe scripts/gen_cpit.py`.'}</p>
        ) : !certCase ? (
          <p className="pf-note">{es ? 'caso no encontrado' : 'case not found'}</p>
        ) : (
          <>
            <div className="pf-seg" style={{ marginBottom: '0.6rem' }}>
              {Object.keys(cert.cases).map((id) => (
                <button key={id} className={`chip ${certId === id ? 'on' : ''}`} onClick={() => setCertId(id)}>{id}</button>
              ))}
            </div>
            <NpvPeriodChart cum={certCase.perPeriod.map((p) => p.cumulativeNpv)} bound={certCase.certifiedBoundNpv}
                            upl={certCase.uplValue} es={es} />
            <div className="pf-kpis">
              <Kpi label={es ? 'cota certificada NPV' : 'certified NPV bound'} value={fM(certCase.certifiedBoundNpv)} />
              <Kpi label={es ? 'NPV plan factible' : 'feasible schedule NPV'} value={fM(certCase.roundedScheduleNpv)} />
              <Kpi label={es ? 'brecha de integralidad' : 'integrality gap'} value={`${certCase.integralityGapPct.toFixed(1)}%`} />
              <Kpi label={es ? 'control dualidad' : 'duality control'} value={certCase.controls.dualityMatch ? (es ? 'PASA' : 'PASS') : 'FAIL'} />
            </div>
            <p className="pf-cap">{es
              ? `Fuente: ${certCase.source}. Motor: relajación LP de CPIT (Bienstock-Zuckerberg 2010 / Chicoisne 2012) vía scipy HiGHS; ${certCase.periods} periodos, tasa ${(certCase.discountRatePerPeriod * 100).toFixed(0)}%. La relajación LP es una cota superior certificada del NPV, no un plan; el plan redondeado es una heurística factible y la brecha se reporta arriba.`
              : `Source: ${certCase.source}. Engine: CPIT LP relaxation (Bienstock-Zuckerberg 2010 / Chicoisne 2012) via scipy HiGHS; ${certCase.periods} periods, rate ${(certCase.discountRatePerPeriod * 100).toFixed(0)}%. The LP relaxation is a certified upper bound on the NPV, not a schedule; the rounded schedule is a feasible heuristic and the gap is reported above.`}</p>
            <p className="pf-cap pf-muted">{es
              ? `Control de dualidad: a tasa 0 y capacidad infinita la cota LP iguala el pit último exacto (${(certCase.uplValue / 1e6).toFixed(1)} M, ${certCase.uplBlocks} bloques) bloque por bloque, y la cota domina al NPV factible.`
              : `Duality control: at rate 0 and infinite capacity the LP bound equals the exact ultimate pit (${(certCase.uplValue / 1e6).toFixed(1)} M, ${certCase.uplBlocks} blocks) block-for-block, and the bound dominates the feasible NPV.`}</p>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="pf-kpi"><div className="pf-kpi-v">{value}</div><div className="pf-kpi-l">{label}</div></div>;
}
