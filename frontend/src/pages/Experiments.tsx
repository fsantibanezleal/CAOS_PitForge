import { useEffect, useState } from 'react';
import { Callout, useShellLang } from '@fasl-work/caos-app-shell';
import { loadCaseResults } from '../lib/artifacts.ts';
import type { CaseResultsFile } from '../lib/contract.types.ts';

export default function Experiments() {
  const es = useShellLang() === 'es';
  const [data, setData] = useState<CaseResultsFile | null>(null);
  useEffect(() => { loadCaseResults().then(setData).catch(() => setData(null)); }, []);

  return (
    <article className="page-body prose">
      <h1>{es ? 'Experimentos' : 'Experiments'}</h1>
      <p className="lede">{es
        ? 'Cada caso es un experimento con un ancla de validación: una propiedad que el resultado DEBE cumplir. Todas se chequean en el horneado (frontend/test/contract.test.ts).'
        : 'Each case is an experiment with a validation anchor: a property the result MUST satisfy. They are all checked in the bake (frontend/test/contract.test.ts).'}</p>

      {!data ? <p className="pf-note">{es ? 'cargando casos…' : 'loading cases…'}</p> : (
        <div className="pf-exp-grid">
          {Object.entries(data.cases).map(([id, c]) => (
            <div key={id} className="pf-card pf-exp">
              <div className="pf-exp-h"><b>{id}</b> <span>{c.name}</span></div>
              <div className="pf-cap pf-muted">{c.category.split(' (')[0]}</div>
              <div className="pf-kpis">
                <div className="pf-kpi"><div className="pf-kpi-v">${(c.ultimate.pitValue / 1e6).toFixed(0)}M</div><div className="pf-kpi-l">{es ? 'valor' : 'value'}</div></div>
                <div className="pf-kpi"><div className="pf-kpi-v">{c.ultimate.nBlocks}</div><div className="pf-kpi-l">{es ? 'bloques' : 'blocks'}</div></div>
                <div className="pf-kpi"><div className="pf-kpi-v">{c.ultimate.stripRatio.toFixed(2)}</div><div className="pf-kpi-l">strip</div></div>
              </div>
              <div className="pf-anchor">⚓ {c.validationAnchor}</div>
              <div className="pf-cap">{c.expectedBand}</div>
            </div>
          ))}
        </div>
      )}

      <Callout variant="strong" title={es ? 'El oráculo CTRL' : 'The CTRL oracle'}>
        {es
          ? 'CTRL es un modelo de 5×1×3 con un único bloque de mineral profundo: bajo talud 45° el pit óptimo es EXACTAMENTE la pirámide invertida de 9 bloques, valor 10 − 8 = 2. Calculado a mano y verificado por el motor, el ancla de exactitud del solver.'
          : 'CTRL is a 5×1×3 model with a single deep ore block: under a 45° slope the optimal pit is EXACTLY the 9-block inverted pyramid, value 10 − 8 = 2. Hand-computed and verified by the engine, the solver’s exactness anchor.'}
      </Callout>
    </article>
  );
}
