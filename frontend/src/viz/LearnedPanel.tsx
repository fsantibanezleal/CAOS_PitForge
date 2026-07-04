import { useEffect, useMemo, useState } from 'react';
import { blockValue, solveUltimatePit } from '../opt/index.ts';
import { idx, type BlockModel, type EconParams } from '../opt/types.ts';
import { runPitSurrogateBatch } from '../lib/ort.ts';
import { SectionView, type SectionCell } from './SectionView.tsx';
import { viridisCss } from './colormap.ts';

/** Surrogate FAST-PREVIEW tool: the ONNX inclusion classifier runs over the current section on
 * every knob change (one batched onnxruntime-web call), rendered as P(block ∈ pit) against the
 * EXACT pit outline + the live agreement %. Framing is operational: at this teaching scale the
 * exact min-cut is already instant, so the surrogate's value is TRIAGE, at 10⁶–10⁷ blocks it
 * screens candidates before the exact solve. It never replaces the min-cut; held-out metrics
 * live in Benchmark. */
export function LearnedPanel({ model, econ, iy, es }: { model: BlockModel; econ: EconParams; iy: number; es: boolean }) {
  const [prob, setProb] = useState<Float32Array | null>(null);
  const [agree, setAgree] = useState<number | null>(null);
  const [pending, setPending] = useState(false);

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
      label: `(${ix},${iz}) · P(in pit)=${prob ? p.toFixed(2) : ', '} · exact ${exact.inPit[i] ? 'in' : 'out'}`,
    };
  };

  if (!pending && prob === null) {
    return (
      <div className="pf-pending">
        <strong>{es ? 'Surrogate: pendiente de entrenamiento' : 'Surrogate: pending training'}</strong>
        <p>{es ? 'Corre `python -m pflab.pipeline all --retrain` para entrenarlo (torch → ONNX).' : 'Run `python -m pflab.pipeline all --retrain` to train it (torch → ONNX).'}</p>
      </div>
    );
  }

  return (
    <div className="pf-vizstack">
      <div className="pf-plot-t">{es
        ? `Preview instantáneo del pit (surrogate ONNX) en la sección Y=${iy}, a RF=1 (semántica de entrenamiento), color = P(en pit), contorno = pit EXACTO a RF=1. Mueve precio/talud y compara; el slider RF no afecta este tab.`
        : `Instant pit preview (ONNX surrogate) on section Y=${iy}, at RF=1 (training semantics), colour = P(in pit), outline = the EXACT RF=1 pit. Drag price/slope and compare; the RF slider does not affect this tab.`}</div>
      <SectionView nx={model.dims.nx} nz={model.dims.nz} cell={cell} />
      <div className="pf-cap">
        {agree != null
          ? (es ? `Acuerdo con el solver exacto en esta sección: ${(agree * 100).toFixed(1)}%.` : `Agreement with the exact solver on this section: ${(agree * 100).toFixed(1)}%.`)
          : (pending ? (es ? 'inferencia en curso…' : 'inference running…') : (es ? 'modelo no disponible' : 'model unavailable'))}
      </div>
      <p className="pf-cap">{es
        ? 'Herramienta de TRIAGE: a esta escala didáctica el min-cut exacto ya es instantáneo; a 10⁶–10⁷ bloques el surrogate filtra candidatos antes del solve exacto. Nunca reemplaza al exacto. Entrenado en depósitos sintéticos; métricas held-out en Benchmark.'
        : 'A TRIAGE tool: at this teaching scale the exact min-cut is already instant; at 10⁶–10⁷ blocks the surrogate screens candidates before the exact solve. It never replaces the exact result. Trained on synthetic deposits; held-out metrics in Benchmark.'}</p>
    </div>
  );
}
