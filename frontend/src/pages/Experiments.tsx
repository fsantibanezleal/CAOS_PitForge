import { useEffect, useState } from 'react';
import { Callout, Cite, useShellLang } from '@fasl-work/caos-app-shell';
import { type CpitScheduleFile, loadCaseResults, loadCpitSchedule } from '../lib/artifacts.ts';
import type { CaseResultsFile } from '../lib/contract.types.ts';

const fM = (v: number) => `$${(v / 1e6).toFixed(1)}M`;

export default function Experiments() {
  const es = useShellLang() === 'es';
  const [data, setData] = useState<CaseResultsFile | null>(null);
  const [cpit, setCpit] = useState<CpitScheduleFile | null>(null);
  useEffect(() => { loadCaseResults().then(setData).catch(() => setData(null)); }, []);
  useEffect(() => { loadCpitSchedule().then(setCpit).catch(() => setCpit(null)); }, []);

  return (
    <article className="page-body prose">
      <h1>{es ? 'Experimentos' : 'Experiments'}</h1>
      <p className="lede">{es
        ? 'Cada caso es un experimento con un ancla de validación: una propiedad que el resultado debe cumplir. Todas se verifican en el precálculo (frontend/test/contract.test.ts).'
        : 'Each case is an experiment with a validation anchor: a property the result must satisfy. They are all checked in the bake (frontend/test/contract.test.ts).'}</p>

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
          ? 'CTRL es un modelo de 5×1×3 con un único bloque de mineral profundo: bajo talud 45° el pit óptimo es exactamente la pirámide invertida de 9 bloques, valor 10 − 8 = 2. Calculado a mano y verificado por el motor, el ancla de exactitud del solver.'
          : 'CTRL is a 5×1×3 model with a single deep ore block: under a 45° slope the optimal pit is exactly the 9-block inverted pyramid, value 10 − 8 = 2. Hand-computed and verified by the engine, the solver’s exactness anchor.'}
      </Callout>

      <h2>{es ? 'Frontera de scheduling (CPIT): cota certificada + brecha' : 'Scheduling frontier (CPIT): certified bound + gap'}</h2>
      <p>{es
        ? 'El experimento capstone más allá del pit último: la relajación LP del CPIT (Bienstock y Zuckerberg 2010; Chicoisne et al. 2012) da una cota superior certificada del NPV descontado; un plan de pushbacks factible se redondea y se reporta la brecha de integralidad. Ejecutado offline en '
        : 'The capstone experiment beyond the ultimate pit: the CPIT LP relaxation (Bienstock & Zuckerberg 2010; Chicoisne et al. 2012) gives a certified upper bound on the discounted NPV; a feasible pushback schedule is rounded and the integrality gap reported. Run offline in '}
        <Cite id="bienstock2010" />, <Cite id="chicoisne2012" />.</p>
      {!cpit ? (
        <Callout variant="honest" title={es ? 'Artefacto CPIT ausente' : 'CPIT artifact absent'}>
          {es ? 'Ejecutar `.venv-precompute/Scripts/python.exe scripts/gen_cpit.py` para generar data/derived/cpit-schedule.json.' : 'Run `.venv-precompute/Scripts/python.exe scripts/gen_cpit.py` to generate data/derived/cpit-schedule.json.'}
        </Callout>
      ) : (
        <>
          <table className="cmp-table">
            <thead><tr>
              <th>{es ? 'instancia' : 'instance'}</th><th>{es ? 'periodos · tasa' : 'periods · rate'}</th>
              <th>{es ? 'pit último' : 'ultimate pit'}</th><th>{es ? 'cota certificada' : 'certified bound'}</th>
              <th>{es ? 'NPV factible' : 'feasible NPV'}</th><th>{es ? 'brecha' : 'gap'}</th>
            </tr></thead>
            <tbody>
              {Object.entries(cpit.cases).map(([id, c]) => (
                <tr key={id}>
                  <td><b>{id}</b></td>
                  <td>{c.periods} · {(c.discountRatePerPeriod * 100).toFixed(0)}%</td>
                  <td>{fM(c.uplValue)}</td><td>{fM(c.certifiedBoundNpv)}</td>
                  <td>{fM(c.roundedScheduleNpv)}</td><td>{c.integralityGapPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>{es ? 'Controles negativos obligatorios' : 'Mandatory negative controls'}</h3>
          <table className="cmp-table">
            <thead><tr>
              <th>{es ? 'control' : 'control'}</th>
              {Object.keys(cpit.cases).map((id) => <th key={id}>{id}</th>)}
            </tr></thead>
            <tbody>
              <tr>
                <td>{es ? 'Dualidad (tasa 0 + cap. inf = pit último, bloque por bloque)' : 'Duality (rate 0 + inf capacity = ultimate pit, block-for-block)'}</td>
                {Object.values(cpit.cases).map((c, k) => <td key={k}>{c.controls.dualityMatch ? (es ? 'PASA ✓' : 'PASS ✓') : (es ? 'FALLA ✗' : 'FAIL ✗')}</td>)}
              </tr>
              <tr>
                <td>{es ? 'Cota ≥ NPV factible' : 'Bound ≥ feasible NPV'}</td>
                {Object.values(cpit.cases).map((c, k) => <td key={k}>{c.controls.boundGeqFeasible ? (es ? 'PASA ✓' : 'PASS ✓') : (es ? 'FALLA ✗' : 'FAIL ✗')}</td>)}
              </tr>
              <tr>
                <td>{es ? 'cota LP vs óptimo UPL (dualidad, error)' : 'LP bound vs UPL optimum (duality, error)'}</td>
                {Object.values(cpit.cases).map((c, k) => <td key={k}>{c.controls.dualityBoundVsUpl.toExponential(1)}</td>)}
              </tr>
            </tbody>
          </table>
          <Callout variant="honest" title={es ? 'Lectura honesta' : 'Honest reading'}>
            {es
              ? 'La relajación LP es una cota, no un plan; el plan redondeado es una heurística factible y nunca es óptimo. Los controles atan la línea nueva al óptimo probado: a tasa 0 y capacidad infinita el CPIT reproduce el pit último exacto bloque por bloque (error de la cota vs UPL ~1e-7, ruido de punto flotante), y la cota domina a todo NPV entero factible. La brecha de integralidad (10-11%) es el resultado honesto, ni escondido ni presentado como óptimo. El pit último exacto (min-cut) sigue siendo el ancla y no regresiona.'
              : 'The LP relaxation is a bound, not a schedule; the rounded schedule is a feasible heuristic and never optimal. The controls tie the new lane to the proven optimum: at rate 0 and infinite capacity the CPIT reproduces the exact ultimate pit block-for-block (bound-vs-UPL error ~1e-7, float noise), and the bound dominates every feasible integer NPV. The integrality gap (10-11%) is the honest result, neither hidden nor presented as optimal. The exact ultimate pit (min-cut) stays the anchor and does not regress.'}
          </Callout>
        </>
      )}
    </article>
  );
}
