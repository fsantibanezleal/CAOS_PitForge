import { useEffect, useState } from 'react';
import { Callout, useShellLang } from '@fasl-work/caos-app-shell';
import { loadCaseResults, loadLearned, loadMinelibBench, type LearnedFile, type MinelibBenchFile } from '../lib/artifacts.ts';
import type { CaseResultsFile } from '../lib/contract.types.ts';

const fInt = (v: number) => Math.round(v).toLocaleString('en-US');

export default function Benchmark() {
  const es = useShellLang() === 'es';
  const [data, setData] = useState<CaseResultsFile | null>(null);
  const [learned, setLearned] = useState<LearnedFile | null>(null);
  const [minelib, setMinelib] = useState<MinelibBenchFile | null>(null);
  useEffect(() => { loadCaseResults().then(setData).catch(() => setData(null)); }, []);
  useEffect(() => { loadLearned().then(setLearned).catch(() => setLearned(null)); }, []);
  useEffect(() => { loadMinelibBench().then(setMinelib).catch(() => setMinelib(null)); }, []);
  const u = (id: string) => data?.cases[id]?.ultimate;

  return (
    <article className="page-body prose">
      <h1>Benchmark</h1>
      <p className="lede">{es
        ? 'Comparaciones cruzadas entre casos, las que NO dependen de un solo caso van aquí (no en la App). Todas salen del precálculo exacto del solver.'
        : 'Cross-case comparisons, the ones that do NOT depend on a single case live here (not in the App). All come from the exact solver bake.'}</p>

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

      <h2>{es ? 'MineLib real (UPIT), exacto vs óptimo publicado' : 'Real MineLib (UPIT), exact vs published optimum'}</h2>
      {minelib ? (
        <>
          <table className="cmp-table">
            <thead><tr>
              <th>{es ? 'instancia' : 'instance'}</th><th>{es ? 'bloques' : 'blocks'}</th><th>{es ? 'arcos' : 'arcs'}</th>
              <th>{es ? 'nuestro valor (exacto)' : 'our value (exact)'}</th><th>{es ? 'óptimo publicado' : 'published optimum'}</th>
              <th>{es ? 'error rel.' : 'rel. error'}</th><th>{es ? 'solve (ms)' : 'solve (ms)'}</th>
            </tr></thead>
            <tbody>
              {minelib.results.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.id}</b> {r.match ? '✓' : '✗'}</td>
                  <td>{fInt(r.nBlocks)}</td><td>{fInt(r.nPrecs)}</td>
                  <td>{fInt(r.ourValue)}</td><td>{fInt(r.publishedOptimum)}</td>
                  <td>{r.relError.toExponential(1)}</td><td>{r.solveMsMedian}</td>
                </tr>
              ))}
              {minelib.excluded.map((x) => (
                <tr key={x.id} className="pf-muted">
                  <td>{x.id}</td><td>{fInt(x.nBlocks)}</td><td>, </td>
                  <td>{es ? 'no precalculado' : 'not baked'}</td>
                  <td>{x.publishedOptimum != null ? fInt(x.publishedOptimum) : ', '}</td>
                  <td colSpan={2}>{x.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Callout variant="honest" title={es ? 'Lectura honesta' : 'Honest reading'}>
            {es
              ? `El MISMO motor exacto de la App (Picard → Dinic, solveUpitExplicit) reproduce el óptimo UPIT publicado en las 3 instancias con espejo verificado (error relativo ≤ 2·10⁻⁹, acumulación float sobre valores decimales). Los tiempos son locales (Node, mediana de 3). Las instancias se descargan bajo la licencia académica de MineLib y nunca se redistribuyen; aquí sólo se publican resúmenes. Precalculado ${minelib.bakedAt.slice(0, 10)}.`
              : `The SAME exact engine the App runs (Picard → Dinic, solveUpitExplicit) reproduces the published UPIT optimum on all 3 mirror-verified instances (relative error ≤ 2·10⁻⁹, float accumulation over decimal values). Times are local (Node, median of 3). Instances are downloaded under MineLib's academic grant and NEVER redistributed; only summaries are published here. Baked ${minelib.bakedAt.slice(0, 10)}.`}
          </Callout>
        </>
      ) : (
        <Callout variant="honest" title={es ? 'Bake MineLib no presente' : 'MineLib bake not present'}>
          {es ? 'Corre `scripts/fetch-minelib.mjs` + `scripts/bake-minelib.mjs` localmente (nunca en CI).' : 'Run `scripts/fetch-minelib.mjs` + `scripts/bake-minelib.mjs` locally (never in CI).'}
        </Callout>
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
              ? 'En los campos sintéticos suaves la ley local es muy predecible, así que los tres métodos de ley puntúan alto, la NN es competitiva con la geoestadística, no una victoria dramática. El pit-surrogate es una aproximación rápida fuerte (AUC ≈ 0.98) pero NO la respuesta exacta. Su rol correcto es preprocesamiento exacto acelerado por aprendizaje: ordena reducciones fijar-dentro/fijar-fuera demostrablemente seguras y el min-cut certifica la instancia reducida, así que el óptimo nunca cambia (valor = escala). El corte mínimo siempre manda.'
              : 'On the smooth synthetic fields the local grade is highly predictable, so all three grade methods score high, the NN is competitive with geostatistics, not a dramatic win. The pit-surrogate is a strong fast approximation (AUC ≈ 0.98) but NOT the exact answer. Its correct role is learning-accelerated EXACT preprocessing: it orders provably-safe fix-in/fix-out reductions and the min-cut certifies the reduced instance, so the optimum never changes (value = scale). The min-cut is always the authority.'}
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
