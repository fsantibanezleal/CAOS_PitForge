import { useEffect, useMemo, useRef, useState } from 'react';
import { greedySchedule } from '../opt/index.ts';
import { idx, type BlockModel, type EconParams } from '../opt/types.ts';
import { SectionView, type SectionCell } from './SectionView.tsx';
import { viridisCss } from './colormap.ts';
import { type CpitCase, type CpitScheduleFile, loadCpitSchedule } from '../lib/artifacts.ts';

// The CPIT scheduling tab: the ultimate pit the App already solves exactly is the UNDISCOUNTED, UNCAPACITATED
// limit of a schedule. Here we add the scheduling dimension (time, per-period capacity, discounting -> NPV).
// LEFT/TOP: a paused-by-default bench-sequence animation of a live greedy pushback on the CURRENT deposit.
// BOTTOM: the CERTIFIED NPV-vs-period curve, from the offline LP relaxation (data/derived/cpit-schedule.json),
// with the integrality gap shown honestly. The browser cannot solve the LP, so the certified bound is offline;
// the live schedule is a feasible glass-box heuristic. Honesty: the LP relaxation is a bound, not a schedule.

const fM = (v: number) => `$${(v / 1e6).toFixed(1)} M`;

/** Inline theme-aware NPV-vs-period chart: cumulative NPV bars + a dashed certified-bound (and optional UPL) line. */
function NpvPeriodChart({ cum, bound, upl, es }: { cum: number[]; bound: number; upl?: number; es: boolean }) {
  const W = 560;
  const H = 220;
  const padL = 46;
  const padB = 26;
  const padT = 14;
  const top = Math.max(bound, upl ?? 0, ...cum) * 1.08 || 1;
  const n = cum.length;
  const bw = (W - padL - 10) / n;
  const yOf = (v: number) => padT + (H - padT - padB) * (1 - v / top);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
         aria-label={es ? 'NPV acumulado por periodo con la cota certificada' : 'cumulative NPV by period with the certified bound'}>
      {/* axes */}
      <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--color-border)" />
      <line x1={padL} y1={H - padB} x2={W - 6} y2={H - padB} stroke="var(--color-border)" />
      {/* cumulative NPV bars */}
      {cum.map((v, i) => (
        <rect key={i} x={padL + i * bw + bw * 0.15} y={yOf(v)} width={bw * 0.7} height={Math.max(0, H - padB - yOf(v))}
              fill="var(--color-accent)" opacity={0.85} rx={2}>
          <title>{`${es ? 'periodo' : 'period'} ${i + 1}: ${fM(v)}`}</title>
        </rect>
      ))}
      {/* period labels */}
      {cum.map((_, i) => (
        <text key={i} x={padL + i * bw + bw / 2} y={H - padB + 16} textAnchor="middle"
              fontSize="10" fill="var(--color-fg-faint)">{i + 1}</text>
      ))}
      {/* certified-bound line */}
      <line x1={padL} y1={yOf(bound)} x2={W - 6} y2={yOf(bound)} stroke="var(--color-warn, #d29922)"
            strokeWidth={1.5} strokeDasharray="6 4" />
      <text x={W - 8} y={yOf(bound) - 4} textAnchor="end" fontSize="10" fill="var(--color-warn, #d29922)">
        {(es ? 'cota certificada ' : 'certified bound ') + fM(bound)}
      </text>
      {/* UPL reference line (undiscounted, uncapacitated degenerate limit) */}
      {upl !== undefined && (
        <>
          <line x1={padL} y1={yOf(upl)} x2={W - 6} y2={yOf(upl)} stroke="var(--color-fg-faint)"
                strokeWidth={1} strokeDasharray="2 3" />
          <text x={padL + 4} y={yOf(upl) - 4} fontSize="10" fill="var(--color-fg-faint)">
            {(es ? 'pit ultimo (sin descuento) ' : 'ultimate pit (undiscounted) ') + fM(upl)}
          </text>
        </>
      )}
    </svg>
  );
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
        ? `Secuencia de bancos (pushback) sobre el deposito actual, seccion Y=${iy}, coloreada por periodo de extraccion. La animacion parte pausada y corre UNA vez.`
        : `Bench (pushback) sequence on the current deposit, section Y=${iy}, coloured by extraction period. The animation starts paused and runs ONCE.`}</div>

      <div className="pf-plot-th">
        <div className="pf-seg">
          <button className="chip" onClick={play} disabled={playing}>{playing ? (es ? 'corriendo...' : 'running...') : (es ? '▶ reproducir secuencia' : '▶ play sequence')}</button>
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
        <Kpi label={es ? 'pit ultimo (sin descuento)' : 'ultimate pit (undiscounted)'} value={fM(sched.uplValue)} />
        <Kpi label={es ? 'NPV del plan (vivo)' : 'schedule NPV (live)'} value={fM(sched.npv)} />
        <Kpi label={es ? 'perdida por descuento' : 'discounting loss'} value={`${((1 - sched.npv / (sched.uplValue || 1)) * 100).toFixed(1)}%`} />
        <Kpi label={es ? 'bloques minados' : 'blocks mined'} value={`${sched.minedBlocks}`} />
      </div>

      <div className="pf-card">
        <div className="pf-card-t">{es ? 'Controles del plan (recalculo en vivo)' : 'Schedule controls (live re-solve)'}</div>
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
          ? 'A tasa 0 y capacidad alta el plan mina exactamente el pit ultimo (control de dualidad). Subir la tasa o apretar la capacidad reduce el NPV: eso es la perdida por diferir.'
          : 'At rate 0 and ample capacity the schedule mines exactly the ultimate pit (the duality control). Raising the rate or tightening capacity lowers the NPV: that is the cost of deferral.'}</p>
      </div>

      <div className="pf-card">
        <div className="pf-card-t">{es ? 'Cota certificada (LP offline) + brecha de integralidad' : 'Certified bound (offline LP) + integrality gap'}</div>
        {certErr || !cert ? (
          <p className="pf-note">{es
            ? 'Artefacto cpit-schedule.json ausente. Corre `.venv-precompute/Scripts/python.exe scripts/gen_cpit.py`.'
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
              ? `Fuente: ${certCase.source}. Motor: relajacion LP de CPIT (Bienstock-Zuckerberg 2010 / Chicoisne 2012) via scipy HiGHS; ${certCase.periods} periodos, tasa ${(certCase.discountRatePerPeriod * 100).toFixed(0)}%. La relajacion LP es una COTA superior certificada del NPV, no un plan; el plan redondeado es una heuristica factible y la brecha se reporta arriba.`
              : `Source: ${certCase.source}. Engine: CPIT LP relaxation (Bienstock-Zuckerberg 2010 / Chicoisne 2012) via scipy HiGHS; ${certCase.periods} periods, rate ${(certCase.discountRatePerPeriod * 100).toFixed(0)}%. The LP relaxation is a CERTIFIED upper bound on the NPV, not a schedule; the rounded schedule is a feasible heuristic and the gap is reported above.`}</p>
            <p className="pf-cap pf-muted">{es
              ? `Control de dualidad: a tasa 0 y capacidad infinita la cota LP iguala el pit ultimo exacto (${(certCase.uplValue / 1e6).toFixed(1)} M, ${certCase.uplBlocks} bloques) bloque por bloque, y la cota domina al NPV factible.`
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
