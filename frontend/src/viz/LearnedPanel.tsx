import { useEffect, useMemo, useState } from 'react';
import { blockValue, solveUltimatePit } from '../opt/index.ts';
import { idx, type BlockModel, type EconParams } from '../opt/types.ts';
import { loadLearned, type LearnedFile } from '../lib/artifacts.ts';
import { runPitSurrogateBatch } from '../lib/ort.ts';
import { SectionView, type SectionCell } from './SectionView.tsx';
import { viridisCss } from './colormap.ts';

/** Live demonstration of the pit-inclusion surrogate: it runs the ONNX model (onnxruntime-web) over the current
 * cross-section, renders P(block ∈ pit), and reports its agreement with the EXACT min-cut on that section. Honest —
 * the surrogate is a fast approximation; the exact solver is always the authority. Shows the held-out metrics too. */
export function LearnedPanel({ model, econ, iy, es }: { model: BlockModel; econ: EconParams; iy: number; es: boolean }) {
  const [metrics, setMetrics] = useState<LearnedFile | null>(null);
  const [prob, setProb] = useState<Float32Array | null>(null);
  const [agree, setAgree] = useState<number | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => { loadLearned().then(setMetrics).catch(() => setMetrics(null)); }, []);

  // the exact RF=1 ultimate pit + per-block values (training semantics) for this case.
  const { exact, values } = useMemo(() => {
    const e1: EconParams = { ...econ, revenueFactor: 1 };
    const N = model.dims.nx * model.dims.ny * model.dims.nz;
    const v = new Float64Array(N);
    for (let i = 0; i < N; i++) v[i] = blockValue(model, i, e1);
    return { exact: solveUltimatePit(model, e1), values: v };
  }, [model, econ]);

  // run the surrogate over the current section (one batched onnxruntime-web call).
  useEffect(() => {
    let cancelled = false;
    const { nx, ny, nz } = model.dims;
    const cx = (nx - 1) / 2;
    const cy = (ny - 1) / 2;
    const maxR = Math.hypot(cx, cy) || 1;
    const n = nx * nz;
    const flat = new Float32Array(n * 4);
    let k = 0;
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const i = idx(model.dims, ix, iy, iz);
        let nsum = 0;
        let ncnt = 0;
        for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy && !dz) continue;
          const jx = ix + dx, jy = iy + dy, jz = iz + dz;
          if (jx < 0 || jx >= nx || jy < 0 || jy >= ny || jz < 0 || jz >= nz) continue;
          nsum += values[idx(model.dims, jx, jy, jz)];
          ncnt++;
        }
        flat[k * 4] = iz / Math.max(1, nz - 1);
        flat[k * 4 + 1] = values[i];
        flat[k * 4 + 2] = ncnt ? nsum / ncnt : 0;
        flat[k * 4 + 3] = Math.hypot(ix - cx, iy - cy) / maxR;
        k++;
      }
    }
    setPending(true);
    runPitSurrogateBatch(flat, n).then((p) => {
      if (cancelled) return;
      setPending(false);
      if (!p) { setProb(null); return; }
      setProb(p);
      // agreement vs the exact pit on this section (threshold 0.5).
      let ok = 0;
      let kk = 0;
      for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
        const i = idx(model.dims, ix, iy, iz);
        if ((p[kk] > 0.5) === !!exact.inPit[i]) ok++;
        kk++;
      }
      setAgree(ok / n);
    });
    return () => { cancelled = true; };
  }, [model, iy, values, exact]);

  const cell = (ix: number, iz: number): SectionCell => {
    const { nx } = model.dims;
    const p = prob ? prob[iz * nx + ix] : 0;
    const i = idx(model.dims, ix, iy, iz);
    return {
      color: prob ? viridisCss(p) : null,
      inPit: !!exact.inPit[i], // outline = the EXACT pit, for visual comparison
      label: `(${ix},${iz}) · P(in pit)=${prob ? p.toFixed(2) : '—'} · exact ${exact.inPit[i] ? 'in' : 'out'}`,
    };
  };

  if (metrics === null && !pending && prob === null) {
    return (
      <div className="pf-pending">
        <strong>{es ? 'Modelos aprendidos: pendientes de entrenamiento' : 'Learned models: pending training'}</strong>
        <p>{es ? 'Corre `python -m pflab.pipeline all --retrain` para entrenarlos (torch → ONNX).' : 'Run `python -m pflab.pipeline all --retrain` to train them (torch → ONNX).'}</p>
      </div>
    );
  }

  return (
    <div className="pf-vizstack">
      {metrics && (
        <table className="cmp-table">
          <thead><tr><th>{es ? 'modelo' : 'model'}</th><th>{es ? 'métrica' : 'metric'}</th><th>{es ? 'aprendido' : 'learned'}</th><th>{es ? 'baseline clásico' : 'classical baseline'}</th></tr></thead>
          <tbody>
            <tr><td>grade-NN</td><td>R²</td><td><b>{metrics.gradeNN.r2_vs_holdout}</b></td><td>IDW {metrics.gradeNN.r2_idw} · OK {metrics.gradeNN.r2_ok}</td></tr>
            <tr><td>pit-surrogate</td><td>AUC · acc</td><td><b>{metrics.pitSurrogate.auc}</b> · {metrics.pitSurrogate.acc}</td><td>{es ? 'mayoría' : 'majority'} {metrics.pitSurrogate.baseline}</td></tr>
          </tbody>
        </table>
      )}
      <div className="pf-plot-t">{es ? `Surrogate de inclusión EN VIVO (onnxruntime-web) en la sección Y=${iy} — color = P(en pit), contorno = pit EXACTO` : `LIVE inclusion surrogate (onnxruntime-web) on section Y=${iy} — colour = P(in pit), outline = EXACT pit`}</div>
      <SectionView nx={model.dims.nx} nz={model.dims.nz} cell={cell} />
      <div className="pf-cap">
        {agree != null
          ? (es ? `Acuerdo con el solver exacto en esta sección: ${(agree * 100).toFixed(1)}% — aproximación rápida, no reemplaza el corte mínimo.` : `Agreement with the exact solver on this section: ${(agree * 100).toFixed(1)}% — a fast approximation, it does not replace the min-cut.`)
          : (pending ? (es ? 'inferencia en curso…' : 'inference running…') : (es ? 'modelo no disponible' : 'model unavailable'))}
      </div>
    </div>
  );
}
