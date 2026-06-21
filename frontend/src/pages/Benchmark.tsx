import { useEffect, useState } from 'react';
import { Callout, useShellLang } from '@fasl-work/caos-app-shell';
import { loadCaseResults } from '../lib/artifacts.ts';
import type { CaseResultsFile } from '../lib/contract.types.ts';

export default function Benchmark() {
  const es = useShellLang() === 'es';
  const [data, setData] = useState<CaseResultsFile | null>(null);
  useEffect(() => { loadCaseResults().then(setData).catch(() => setData(null)); }, []);
  const u = (id: string) => data?.cases[id]?.ultimate;

  return (
    <article className="pf-doc">
      <h1>Benchmark</h1>
      <p className="pf-lead">{es
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

      <Callout variant="honest" title={es ? 'Aprendido vs clásico (pendiente)' : 'Learned vs classical (pending)'}>
        {es
          ? 'El benchmark aprendido-vs-clásico (grade-NN vs kriging/IDW por R²; pit-surrogate vs el solver exacto por AUC) aparece aquí una vez entrenados los modelos (commit posterior). El optimizador exacto es siempre la verdad de terreno; los modelos aprendidos son aproximaciones rápidas, nunca lo superan.'
          : 'The learned-vs-classical benchmark (grade-NN vs kriging/IDW by R²; pit-surrogate vs the exact solver by AUC) appears here once the models are trained (a later commit). The exact optimiser is always ground truth; the learned models are fast approximations, never beating it.'}
      </Callout>
    </article>
  );
}
