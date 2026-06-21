import { useEffect, useState } from 'react';
import { Callout, useShellLang } from '@fasl-work/caos-app-shell';
import { loadCaseResults, loadLearned, type LearnedFile } from '../lib/artifacts.ts';
import type { CaseResultsFile } from '../lib/contract.types.ts';

export default function Benchmark() {
  const es = useShellLang() === 'es';
  const [data, setData] = useState<CaseResultsFile | null>(null);
  const [learned, setLearned] = useState<LearnedFile | null>(null);
  useEffect(() => { loadCaseResults().then(setData).catch(() => setData(null)); }, []);
  useEffect(() => { loadLearned().then(setLearned).catch(() => setLearned(null)); }, []);
  const u = (id: string) => data?.cases[id]?.ultimate;

  return (
    <article className="page-body prose">
      <h1>Benchmark</h1>
      <p className="lede">{es
        ? 'Comparaciones cruzadas entre casos — las que NO dependen de un solo caso van aquí (no en la App). Todas salen del horneado exacto del solver.'
        : 'Cross-case comparisons — the ones that do NOT depend on a single case live here (not in the App). All come from the exact solver bake.'}</p>

      {!data ? <p className="pf-note">{es ? 'cargando…' : 'loading…'}</p> : (
        <>
          <h2>{es ? 'Todos los casos' : 'All cases'}</h2>
          <table className="cmp-table">
            <thead><tr>
              <th>{es ? 'caso' : 'case'}</th><th>{es ? 'arquetipo' : 'archetype'}</th>
              <th>{es ? 'valor ($M)' : 'value ($M)'}</th><th>{es ? 'mineral (Mt)' : 'ore (Mt)'}</th>
              <th>strip</th><th>{es ? 'bloques' : 'blocks'}</th>
            </tr></thead>
            <tbody>
              {Object.entries(data.cases).map(([id, c]) => (
                <tr key={id}>
                  <td><b>{id}</b></td><td>{c.archetype ?? 'oracle'}</td>
                  <td>{(c.ultimate.pitValue / 1e6).toFixed(0)}</td>
                  <td>{(c.ultimate.oreTonnes / 1e6).toFixed(2)}</td>
                  <td>{c.ultimate.stripRatio.toFixed(2)}</td>
                  <td>{c.ultimate.nBlocks}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>{es ? 'Sensibilidad económica (mismo pórfido)' : 'Economic sensitivity (same porphyry)'}</h2>
          <p>{es ? 'Precio bajo → pit más chico ⊂ base ⊂ precio alto. El corte mínimo lo decide exacto:' : 'Low price → smaller pit ⊂ base ⊂ high price. The min-cut decides it exactly:'}</p>
          <p className="pf-mono">E01 ({u('E01')?.nBlocks}) ⊂ A01 ({u('A01')?.nBlocks}) ⊂ E02 ({u('E02')?.nBlocks}) {es ? 'bloques' : 'blocks'}</p>

          <h2>{es ? 'Sensibilidad de talud' : 'Slope sensitivity'}</h2>
          <p>{es ? 'Paredes más planas (45°→30°→18°) → más descapote → menor valor:' : 'Flatter walls (45°→30°→18°) → more stripping → lower value:'}</p>
          <p className="pf-mono">$
            {((u('A01')?.pitValue ?? 0) / 1e6).toFixed(0)}M (45°) ≥ $
            {((u('G01')?.pitValue ?? 0) / 1e6).toFixed(0)}M (30°) ≥ $
            {((u('G02')?.pitValue ?? 0) / 1e6).toFixed(0)}M (18°)
          </p>
        </>
      )}

      <h2>{es ? 'Aprendido vs clásico' : 'Learned vs classical'}</h2>
      {learned ? (
        <>
          <table className="cmp-table">
            <thead><tr>
              <th>{es ? 'modelo' : 'model'}</th><th>{es ? 'métrica' : 'metric'}</th>
              <th>{es ? 'aprendido' : 'learned'}</th><th>{es ? 'baseline clásico' : 'classical baseline'}</th>
              <th>{es ? 'held-out n' : 'held-out n'}</th>
            </tr></thead>
            <tbody>
              <tr><td>grade-NN</td><td>R²</td><td><b>{learned.gradeNN.r2_vs_holdout}</b></td>
                <td>IDW {learned.gradeNN.r2_idw} · OK {learned.gradeNN.r2_ok}</td><td>{learned.gradeNN.nEval}</td></tr>
              <tr><td>pit-surrogate</td><td>AUC · acc</td><td><b>{learned.pitSurrogate.auc}</b> · {learned.pitSurrogate.acc}</td>
                <td>{es ? 'mayoría' : 'majority'} {learned.pitSurrogate.baseline}</td><td>{learned.pitSurrogate.nEval}</td></tr>
            </tbody>
          </table>
          <Callout variant="honest" title={es ? 'Lectura honesta' : 'Honest reading'}>
            {es
              ? 'En los campos sintéticos suaves la ley local es muy predecible, así que los tres métodos de ley puntúan alto — la NN es competitiva con la geoestadística, no una victoria dramática. El pit-surrogate es una aproximación rápida fuerte (AUC ≈ 0.98) pero NO la respuesta exacta; el corte mínimo siempre manda.'
              : 'On the smooth synthetic fields the local grade is highly predictable, so all three grade methods score high — the NN is competitive with geostatistics, not a dramatic win. The pit-surrogate is a strong fast approximation (AUC ≈ 0.98) but NOT the exact answer; the min-cut is always the authority.'}
          </Callout>
        </>
      ) : (
        <Callout variant="honest" title={es ? 'Modelos no entrenados' : 'Models not trained'}>
          {es ? 'Corre `python -m pflab.pipeline all --retrain` para entrenarlos.' : 'Run `python -m pflab.pipeline all --retrain` to train them.'}
        </Callout>
      )}
    </article>
  );
}
