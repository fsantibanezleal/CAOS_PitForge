import { useEffect, useMemo, useState } from 'react';
import { solveUltimatePit } from '../opt/index.ts';
import { idx, type BlockModel, type EconParams } from '../opt/types.ts';
import { runGradeNNBatch } from '../lib/ort.ts';
import {
  assembleEstimated, buildInfillTargets, drillMask, idwFromStencil, rmseOnTargets,
} from '../lib/infill.ts';
import { SectionView, type SectionCell } from './SectionView.tsx';
import { viridisCss } from './colormap.ts';

const FRACTIONS = [0.5, 0.35, 0.25, 0.15, 0.08];
const fM = (v: number) => `$${(v / 1e6).toFixed(1)} M`;
const pct = (a: number, b: number) => (b !== 0 ? `${(((a - b) / Math.abs(b)) * 100).toFixed(1)}%` : ', ');

interface Result {
  fraction: number;
  nDrilled: number;
  nTargets: number;
  truthValue: number;
  nn: { value: number; rmse: number; model: BlockModel; inPit: Uint8Array } | null; // null → ONNX unavailable
  idw: { value: number; rmse: number; model: BlockModel; inPit: Uint8Array };
}

/** Grade-infill what-if, the learned model as a working tool. Pick a drilling density; the
 *  undrilled grades are re-estimated by grade-nn (ONNX, in-browser) and by the IDW baseline it
 *  was benchmarked against; the exact pit is re-solved on each estimated deposit. The readout is
 *  operational: how much pit value does drilling density buy, and does the learned infill beat
 *  the classical one? One batched inference per knob change, no loops. */
export function InfillPanel({ model, econ, rf, iy, present, es }: {
  model: BlockModel; econ: EconParams; rf: number; iy: number; present: Uint8Array | null; es: boolean;
}) {
  const [fraction, setFraction] = useState(0.25);
  const [view, setView] = useState<'nn' | 'idw' | 'truth'>('nn');
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const econRF = useMemo<EconParams>(() => ({ ...econ, revenueFactor: rf }), [econ, rf]);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    const N = model.dims.nx * model.dims.ny * model.dims.nz;
    const drilled = drillMask(N, fraction, 12345, present);
    const { targets, stencils } = buildInfillTargets(model, drilled, present);

    const idwEst = new Float64Array(targets.length);
    for (let t = 0; t < targets.length; t++) idwEst[t] = idwFromStencil(stencils, t * 27);
    const idwModel = assembleEstimated(model, drilled, targets, idwEst, 'IDW infill');
    const truth = solveUltimatePit(model, econRF);
    const idwPit = solveUltimatePit(idwModel, econRF);

    runGradeNNBatch(stencils, targets.length).then((nnEst) => {
      if (cancelled) return;
      let nn: Result['nn'] = null;
      if (nnEst) {
        const nnModel = assembleEstimated(model, drilled, targets, nnEst, 'grade-nn infill');
        const nnPit = solveUltimatePit(nnModel, econRF);
        nn = { value: nnPit.pitValue, rmse: rmseOnTargets(model, targets, nnEst), model: nnModel, inPit: nnPit.inPit };
      }
      let nDrilled = 0;
      for (let i = 0; i < N; i++) if (drilled[i]) nDrilled++;
      setRes({
        fraction, nDrilled, nTargets: targets.length, truthValue: truth.pitValue,
        nn,
        idw: { value: idwPit.pitValue, rmse: rmseOnTargets(model, targets, idwEst), model: idwModel, inPit: idwPit.inPit },
      });
      setBusy(false);
    });
    return () => { cancelled = true; };
  }, [model, econRF, fraction, present]);

  const gradeMax = useMemo(() => {
    let m = 0;
    for (let i = 0; i < model.grade.length; i++) if ((!present || present[i]) && model.grade[i] > m) m = model.grade[i];
    return m || 1;
  }, [model, present]);

  const truthPit = useMemo(() => solveUltimatePit(model, econRF), [model, econRF]);

  const shown = view === 'truth'
    ? { model, inPit: truthPit.inPit }
    : view === 'nn' && res?.nn ? { model: res.nn.model, inPit: res.nn.inPit }
    : res ? { model: res.idw.model, inPit: res.idw.inPit } : { model, inPit: truthPit.inPit };

  const cell = (ix: number, iz: number): SectionCell => {
    const i = idx(model.dims, ix, iy, iz);
    if (present && !present[i]) return { color: null, inPit: false, label: `(${ix},${iz}) · no block` };
    const g = shown.model.grade[i];
    return {
      color: viridisCss(Math.min(1, g / gradeMax)),
      inPit: !!shown.inPit[i],
      label: `(${ix},${iz}) · ${es ? 'ley' : 'grade'} ${(g * 100).toFixed(2)}% (${es ? 'real' : 'true'} ${(model.grade[i] * 100).toFixed(2)}%)`,
    };
  };

  return (
    <div className="pf-vizstack">
      <div className="pf-plot-th">
        <div className="pf-plot-t">{es
          ? 'Efecto de perforar menos: infill de leyes (grade-nn vs IDW), pit exacto re-resuelto'
          : 'Effect of drilling less: grade infill (grade-nn vs IDW), exact pit re-solved'}</div>
        <div className="pf-seg">
          {FRACTIONS.map((f) => (
            <button key={f} className={`chip ${fraction === f ? 'on' : ''}`} onClick={() => setFraction(f)}>{Math.round(f * 100)}%</button>
          ))}
        </div>
      </div>

      {res && (
        <div className="pf-kpis">
          <Kpi label={es ? 'perforados / a estimar' : 'drilled / to estimate'} value={`${res.nDrilled} / ${res.nTargets}`} />
          <Kpi label={es ? 'valor pit (conocimiento total)' : 'pit value (full knowledge)'} value={fM(res.truthValue)} />
          {res.nn && <Kpi label={`grade-nn (Δ ${pct(res.nn.value, res.truthValue)})`} value={fM(res.nn.value)} />}
          <Kpi label={`IDW (Δ ${pct(res.idw.value, res.truthValue)})`} value={fM(res.idw.value)} />
          {res.nn && <Kpi label={es ? 'RMSE ley · nn vs idw' : 'grade RMSE · nn vs idw'} value={`${(res.nn.rmse * 100).toFixed(3)} / ${(res.idw.rmse * 100).toFixed(3)} %`} />}
        </div>
      )}

      <div className="pf-plot-th">
        <div className="pf-plot-t">{es ? `Sección Y=${iy}, campo de leyes estimado · contorno = su pit exacto` : `Section Y=${iy}, estimated grade field · outline = its exact pit`}</div>
        <div className="pf-seg">
          {res?.nn && <button className={`chip ${view === 'nn' ? 'on' : ''}`} onClick={() => setView('nn')}>grade-nn</button>}
          <button className={`chip ${view === 'idw' ? 'on' : ''}`} onClick={() => setView('idw')}>IDW</button>
          <button className={`chip ${view === 'truth' ? 'on' : ''}`} onClick={() => setView('truth')}>{es ? 'real' : 'truth'}</button>
        </div>
      </div>
      <SectionView nx={model.dims.nx} nz={model.dims.nz} cell={cell} />

      {busy && <p className="pf-cap">{es ? 'estimando + re-resolviendo…' : 'estimating + re-solving…'}</p>}
      {res && !res.nn && !busy && (
        <p className="pf-note">{es
          ? 'grade-nn.onnx no disponible en este build, se muestra solo el baseline IDW. Entrenar con `--retrain` para el what-if completo.'
          : 'grade-nn.onnx unavailable in this build, showing the IDW baseline only. Train with `--retrain` for the full what-if.'}</p>
      )}
      <p className="pf-cap">{es
        ? 'Máscara de perforación determinista (semilla fija). grade-nn se ejecuta en el navegador (onnxruntime-web) sobre el stencil 3×3×3 con el que fue entrenado; IDW es el baseline exacto del benchmark. El pit siempre lo decide el min-cut exacto sobre cada depósito estimado, la herramienta mide cuánto conocimiento geológico compra la perforación. Modelos entrenados en depósitos sintéticos.'
        : 'Deterministic drill mask (fixed seed). grade-nn runs in-browser (onnxruntime-web) on the 3×3×3 stencil it was trained on; IDW is the exact benchmark baseline. The pit is always decided by the exact min-cut on each estimated deposit, the tool measures how much geological knowledge drilling buys. Models trained on synthetic deposits.'}</p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="pf-kpi"><div className="pf-kpi-v">{value}</div><div className="pf-kpi-l">{label}</div></div>;
}
