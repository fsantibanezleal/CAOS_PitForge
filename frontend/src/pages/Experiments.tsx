import { useCallback, useEffect, useState } from 'react';
import { Callout, Cite, useShellLang } from '@fasl-work/caos-app-shell';
import { type ContractCase, type CpitScheduleFile, loadContractCases, loadCpitSchedule } from '../lib/artifacts.ts';
import { CASES, caseCategoryName, caseExpectedBand, caseName, caseValidationAnchor } from '../opt/cases.ts';

const fM = (v: number) => `$${(v / 1e6).toFixed(1)}M`;
const pass = (value: boolean, es: boolean) => value ? (es ? 'PASA' : 'PASS') : (es ? 'FALLA' : 'FAIL');

export default function Experiments() {
  const es = useShellLang() === 'es';
  const [cases, setCases] = useState<ContractCase[] | null>(null);
  const [contractError, setContractError] = useState<string | null>(null);
  const [cpit, setCpit] = useState<CpitScheduleFile | null | undefined>(undefined);
  const [cpitError, setCpitError] = useState(false);
  const loadCases = useCallback(() => {
    setCases(null);
    setContractError(null);
    loadContractCases().then(setCases).catch((error: unknown) => {
      setCases([]);
      setContractError(error instanceof Error ? error.message : String(error));
    });
  }, []);
  const loadCpit = useCallback(() => {
    setCpit(undefined);
    setCpitError(false);
    loadCpitSchedule().then(setCpit).catch(() => { setCpit(null); setCpitError(true); });
  }, []);
  useEffect(loadCases, [loadCases]);
  useEffect(loadCpit, [loadCpit]);

  return (
    <article className="page-body prose">
      <h1>{es ? 'Experimentos' : 'Experiments'}</h1>
      <p className="lede">{es
        ? 'Cada caso es un experimento con un ancla de validación: una propiedad que el resultado debe cumplir. Todas se verifican en el precálculo (frontend/test/contract.test.ts).'
        : 'Each case is an experiment with a validation anchor: a property the result must satisfy. They are all checked in the bake (frontend/test/contract.test.ts).'}</p>

      {!cases ? <div className="pf-status" role="status">{es ? 'Cargando casos…' : 'Loading cases…'}</div> : contractError ? (
        <div className="pf-status" data-kind="error" role="alert">
          <strong>{es ? 'Contrato de artefactos inválido' : 'Invalid artifact contract'}</strong>
          <p>{contractError}</p>
          <div className="pf-status-actions"><button className="chip" onClick={loadCases}>{es ? 'Reintentar' : 'Retry'}</button></div>
        </div>
      ) : cases.length === 0 ? (
        <div className="pf-status" data-kind="empty">
          <strong>{es ? 'No hay casos publicados' : 'No published cases'}</strong>
          <p>{es ? 'El índice es válido pero no contiene casos.' : 'The index is valid but contains no cases.'}</p>
        </div>
      ) : (
        <div className="pf-exp-grid">
          {cases.map(({ manifest, trace }) => {
            const canonical = CASES.find((pitCase) => pitCase.id === trace.case_id);
            return (
            <div key={trace.case_id} className="pf-card pf-exp">
              <div className="pf-exp-h"><b>{trace.case_id}</b> <span>{canonical ? caseName(canonical, es) : trace.name}</span></div>
              <div className="pf-cap pf-muted">{canonical ? caseCategoryName(canonical, es) : trace.category.split(' (')[0]}</div>
              <div className="pf-kpis">
                <div className="pf-kpi"><div className="pf-kpi-v">${(trace.ultimate.pitValue / 1e6).toFixed(0)}M</div><div className="pf-kpi-l">{es ? 'valor' : 'value'}</div></div>
                <div className="pf-kpi"><div className="pf-kpi-v">{trace.ultimate.nBlocks}</div><div className="pf-kpi-l">{es ? 'bloques' : 'blocks'}</div></div>
                <div className="pf-kpi"><div className="pf-kpi-v">{trace.ultimate.stripRatio.toFixed(2)}</div><div className="pf-kpi-l">strip</div></div>
              </div>
              <div className="pf-anchor">⚓ {canonical ? caseValidationAnchor(canonical, es) : manifest.validation_anchor}</div>
              <div className="pf-cap">{canonical ? caseExpectedBand(canonical, es) : trace.expected_band}</div>
            </div>
            );
          })}
        </div>
      )}

      <Callout variant="strong" title={es ? 'El oráculo CTRL' : 'The CTRL oracle'}>
        {es
          ? 'CTRL es un modelo de 5×1×3 con un único bloque de mineral profundo: bajo talud 45° el pit óptimo es exactamente la pirámide invertida de 9 bloques, valor 10 − 8 = 2. Calculado a mano y verificado por el motor, el ancla de exactitud del solver.'
          : 'CTRL is a 5×1×3 model with a single deep ore block: under a 45° slope the optimal pit is exactly the 9-block inverted pyramid, value 10 − 8 = 2. Hand-computed and verified by the engine, the solver’s exactness anchor.'}
      </Callout>

      <h2>{es ? 'Frontera de scheduling (CPIT): cota certificada + brecha' : 'Scheduling frontier (CPIT): certified bound + gap'}</h2>
      <p>{es
        ? 'El experimento capstone más allá del pit último: la relajación LP acumulativa de CPIT de Chicoisne et al. da una cota superior certificada; una heurística voraz independiente produce un plan factible y se reporta la brecha entre ambos. Se ejecuta offline con SciPy/HiGHS. Bienstock-Zuckerberg se cita como contexto especializado, no como el algoritmo ejecutado: '
        : 'The capstone experiment beyond the ultimate pit: the cumulative Chicoisne et al. CPIT LP gives a certified upper bound; an independent greedy heuristic produces a feasible schedule and the gap between them is reported. It runs offline through SciPy/HiGHS. Bienstock-Zuckerberg is cited as specialized context, not as the algorithm executed: '}
        <Cite id="chicoisne2012" />, <Cite id="virtanen2020" />, <Cite id="bienstock2010" />.</p>
      {cpit === undefined ? (
        <div className="pf-status" role="status">{es ? 'Cargando el artefacto CPIT…' : 'Loading the CPIT artifact…'}</div>
      ) : !cpit ? (
        <div className="pf-status" data-kind="error" role="alert">
          <strong>{es ? 'Artefacto CPIT no disponible' : 'CPIT artifact unavailable'}</strong>
          <p>{cpitError
            ? (es ? 'No se pudo leer el artefacto publicado. El resto de los experimentos sigue disponible.' : 'The published artifact could not be read. The remaining experiments are still available.')
            : (es ? 'El artefacto no contiene datos.' : 'The artifact contains no data.')}</p>
          <div className="pf-status-actions"><button className="chip" onClick={loadCpit}>{es ? 'Reintentar' : 'Retry'}</button></div>
        </div>
      ) : (
        <>
          <table className="cmp-table">
            <thead><tr>
              <th>{es ? 'instancia y escenario' : 'instance and scenario'}</th><th>{es ? 'periodos · tasa' : 'periods · rate'}</th>
              <th>{es ? 'pit último' : 'ultimate pit'}</th><th>{es ? 'cota certificada' : 'certified bound'}</th>
              <th>{es ? 'NPV factible' : 'feasible NPV'}</th><th>{es ? 'brecha' : 'gap'}</th>
            </tr></thead>
            <tbody>
              {Object.entries(cpit.cases).map(([id, c]) => (
                <tr key={id}>
                  <td><b>{id}</b><div className="pf-cap pf-muted">{c.scenario.label}</div>
                    <div className="pf-cap">{c.provenance.kind === 'minelib' ? <>
                      <a href={`https://doi.org/${c.provenance.citationDoi}`}>MineLib</a> · <a href={c.provenance.licenseUrl}>{c.provenance.license}</a>
                    </> : <><a href={c.provenance.generatorRepository}>{c.provenance.generator} {c.provenance.generatorVersion}</a> · {c.provenance.license}</>}</div>
                  </td>
                  <td>{c.periods} · {(c.discountRatePerPeriod * 100).toFixed(0)}%</td>
                  <td>{fM(c.uplValue)}</td><td>{fM(c.certifiedBoundNpv)}</td>
                  <td>{fM(c.feasibleHeuristicNpv)}</td><td>{c.boundToFeasibleGapPct.toFixed(1)}%</td>
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
                {Object.values(cpit.cases).map((c, k) => <td key={k}>{pass(c.controls.dualityMatch, es)}</td>)}
              </tr>
              <tr>
                <td>{es ? 'Cota ≥ NPV factible' : 'Bound ≥ feasible NPV'}</td>
                {Object.values(cpit.cases).map((c, k) => <td key={k}>{pass(c.controls.boundGeqFeasible, es)}</td>)}
              </tr>
              <tr>
                <td>{es ? 'Límites de recursos respetados' : 'Resource limits respected'}</td>
                {Object.values(cpit.cases).map((c, k) => <td key={k}>{pass(c.controls.resourceLimitsRespected, es)}</td>)}
              </tr>
              <tr>
                <td>{es ? 'Precedencias respetadas' : 'Precedence respected'}</td>
                {Object.values(cpit.cases).map((c, k) => <td key={k}>{pass(c.controls.precedenceRespected, es)}</td>)}
              </tr>
              <tr>
                <td>{es ? 'Pit último programado completamente' : 'Ultimate pit completely scheduled'}</td>
                {Object.values(cpit.cases).map((c, k) => <td key={k}>{pass(c.controls.completeUltimatePit, es)}</td>)}
              </tr>
              <tr>
                <td>{es ? 'cota LP vs óptimo UPL (dualidad, error)' : 'LP bound vs UPL optimum (duality, error)'}</td>
                {Object.values(cpit.cases).map((c, k) => <td key={k}>{c.controls.dualityBoundVsUpl.toExponential(1)}</td>)}
              </tr>
            </tbody>
          </table>
          {cpit.cases.newman1?.publishedComparison && (
            <>
              <h3>{es ? 'Comparación con el escenario publicado newman1.cpit' : 'Published newman1.cpit comparison'}</h3>
              <table className="cmp-table">
                <thead><tr>
                  <th>{es ? 'referencia' : 'reference'}</th><th>{es ? 'MineLib publicado' : 'published MineLib'}</th>
                  <th>PitForge</th><th>{es ? 'diferencia' : 'difference'}</th>
                </tr></thead>
                <tbody>
                  <tr>
                    <td>{es ? 'cota superior LP' : 'LP upper bound'}</td>
                    <td>{fM(cpit.cases.newman1.publishedComparison.mineLibLpUpperBoundNpv)}</td>
                    <td>{fM(cpit.cases.newman1.certifiedBoundNpv)}</td>
                    <td>{cpit.cases.newman1.publishedComparison.ourBoundRelativeError.toExponential(2)} rel.</td>
                  </tr>
                  <tr>
                    <td>{es ? 'plan factible de referencia / heurística PitForge' : 'reference feasible / PitForge heuristic'}</td>
                    <td>{fM(cpit.cases.newman1.publishedComparison.mineLibPublishedFeasibleNpv)}</td>
                    <td>{fM(cpit.cases.newman1.feasibleHeuristicNpv)}</td>
                    <td>{cpit.cases.newman1.publishedComparison.ourHeuristicRelativeToPublishedFeasiblePct.toFixed(2)}%</td>
                  </tr>
                  <tr>
                    <td>{es ? 'brecha publicada / brecha PitForge contra su cota' : 'published gap / PitForge gap to its bound'}</td>
                    <td>{cpit.cases.newman1.publishedComparison.mineLibPublishedGapPct.toFixed(1)}%</td>
                    <td>{cpit.cases.newman1.boundToFeasibleGapPct.toFixed(2)}%</td><td>{es ? 'definiciones nombradas' : 'named definitions'}</td>
                  </tr>
                </tbody>
              </table>
              <p className="pf-cap pf-muted">{es
                ? 'La heurística factible de PitForge supera levemente el valor factible histórico citado, pero no se presenta como un nuevo mejor conocido. La cota publicada sigue siendo el certificado y toda comparación conserva su definición.'
                : 'The PitForge feasible heuristic is slightly above the cited historical feasible value, but is not claimed as a new best-known result. The published upper bound remains the certificate and every comparison keeps its definition.'}</p>
            </>
          )}
          <Callout variant="honest" title={es ? 'Lectura honesta' : 'Honest reading'}>
            {es
              ? 'La relajación LP es una cota, no un plan; el plan redondeado es una heurística factible y no se afirma que sea óptimo. En el escenario MineLib publicado, la brecha PitForge es 3,81% contra la cota publicada reproducida; en el escenario didáctico separado del gemelo, la brecha es 11,29%. Los escenarios no son comparables y sus brechas nunca se mezclan.'
              : 'The LP relaxation is a bound, not a schedule; the feasible schedule is an independent greedy heuristic, not an LP rounding, and is not claimed optimal. In the published MineLib scenario, PitForge has a 3.81% gap to the reproduced published bound; in the twin\'s separate didactic scenario, the gap is 11.29%. The scenarios are not comparable and their gaps are never mixed.'}
          </Callout>
        </>
      )}
    </article>
  );
}
