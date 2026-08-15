import { useCallback, useEffect, useState } from 'react';
import { Callout, useShellLang } from '@fasl-work/caos-app-shell';
import { loadCaseResults, loadLearned, loadMinelibBench, type LearnedFile, type MinelibBenchFile } from '../lib/artifacts.ts';
import type { CaseResultsFile } from '../lib/contract.types.ts';

const fInt = (v: number) => Math.round(v).toLocaleString('en-US');

export default function Benchmark() {
  const es = useShellLang() === 'es';
  const [data, setData] = useState<CaseResultsFile | null | undefined>(undefined);
  const [learned, setLearned] = useState<LearnedFile | null | undefined>(undefined);
  const [minelib, setMinelib] = useState<MinelibBenchFile | null | undefined>(undefined);
  const loadData = useCallback(() => { setData(undefined); loadCaseResults().then(setData).catch(() => setData(null)); }, []);
  const loadLearnedData = useCallback(() => { setLearned(undefined); loadLearned().then(setLearned).catch(() => setLearned(null)); }, []);
  const loadMinelibData = useCallback(() => { setMinelib(undefined); loadMinelibBench().then(setMinelib).catch(() => setMinelib(null)); }, []);
  useEffect(loadData, [loadData]);
  useEffect(loadLearnedData, [loadLearnedData]);
  useEffect(loadMinelibData, [loadMinelibData]);
  const u = (id: string) => data?.cases[id]?.ultimate;

  return (
    <article className="page-body prose">
      <h1>Benchmark</h1>
      <p className="lede">{es
        ? 'Comparaciones cruzadas entre casos, las que no dependen de un solo caso van aquí (no en la App). Todas salen del precálculo exacto del solver.'
        : 'Cross-case comparisons, the ones that do not depend on a single case live here (not in the App). All come from the exact solver bake.'}</p>

      {data === undefined ? <div className="pf-status" role="status">{es ? 'Cargando resultados…' : 'Loading results…'}</div> : !data ? (
        <div className="pf-status" data-kind="error" role="alert">
          <strong>{es ? 'Resultados no disponibles' : 'Results unavailable'}</strong>
          <p>{es ? 'No se pudo leer el artefacto de resultados. Las otras secciones siguen operativas.' : 'The results artifact could not be read. Other sections remain operational.'}</p>
          <div className="pf-status-actions"><button className="chip" onClick={loadData}>{es ? 'Reintentar' : 'Retry'}</button></div>
        </div>
      ) : (
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
          <p>{es ? 'Precio bajo: pit más pequeño ⊂ base ⊂ precio alto. El corte mínimo lo decide exacto:' : 'Low price: smaller pit ⊂ base ⊂ high price. The min-cut decides it exactly:'}</p>
          <p className="pf-mono">E01 ({u('E01')?.nBlocks}) ⊂ A01 ({u('A01')?.nBlocks}) ⊂ E02 ({u('E02')?.nBlocks}) {es ? 'bloques' : 'blocks'}</p>

          <h2>{es ? 'Sensibilidad de talud' : 'Slope sensitivity'}</h2>
          <p>{es ? 'Paredes más planas (45°, 30°, 18°) dan más descapote y menor valor:' : 'Flatter walls (45°, 30°, 18°) give more stripping and lower value:'}</p>
          <p className="pf-mono">$
            {((u('A01')?.pitValue ?? 0) / 1e6).toFixed(0)}M (45°) ≥ $
            {((u('G01')?.pitValue ?? 0) / 1e6).toFixed(0)}M (30°) ≥ $
            {((u('G02')?.pitValue ?? 0) / 1e6).toFixed(0)}M (18°)
          </p>
        </>
      )}

      <h2>{es ? 'MineLib real (UPIT), exacto vs óptimo publicado' : 'Real MineLib (UPIT), exact vs published optimum'}</h2>
      {minelib === undefined ? (
        <div className="pf-status" role="status">{es ? 'Cargando benchmark MineLib…' : 'Loading MineLib benchmark…'}</div>
      ) : minelib ? (
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
              ? `El mismo motor exacto de la App (Picard → Dinic, solveUpitExplicit) reproduce el óptimo UPIT publicado en las 3 instancias con espejo verificado (error relativo ≤ 2·10⁻⁹, acumulación float sobre valores decimales). Los tiempos son locales (Node, mediana de 3). MineLib es CC BY-SA 3.0 Unported; por política del proyecto las instancias se descargan a memoria y aquí sólo se publican resúmenes atribuidos. Precalculado ${minelib.bakedAt.slice(0, 10)}.`
              : `The same exact engine the App runs (Picard → Dinic, solveUpitExplicit) reproduces the published UPIT optimum on all 3 mirror-verified instances (relative error ≤ 2·10⁻⁹, float accumulation over decimal values). Times are local (Node, median of 3). MineLib is CC BY-SA 3.0 Unported; by project policy instances are fetched into memory and only attributed summaries are published here. Baked ${minelib.bakedAt.slice(0, 10)}.`}
          </Callout>
        </>
      ) : (
        <div className="pf-status" data-kind="error" role="alert">
          <strong>{es ? 'Benchmark MineLib no disponible' : 'MineLib benchmark unavailable'}</strong>
          <p>{es ? 'No se pudo leer el resumen publicado; no se ocultan valores sustitutos.' : 'The published summary could not be read; no substitute values are shown.'}</p>
          <div className="pf-status-actions"><button className="chip" onClick={loadMinelibData}>{es ? 'Reintentar' : 'Retry'}</button></div>
        </div>
      )}

      <h2>{es ? 'Aprendido vs clásico' : 'Learned vs classical'}</h2>
      {learned === undefined ? (
        <div className="pf-status" role="status">{es ? 'Cargando evaluación aprendida…' : 'Loading learned evaluation…'}</div>
      ) : learned ? (
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
                <td>AUC {learned.pitSurrogate.baseline_auc} · {es ? 'exactitud mayoría' : 'majority accuracy'} {learned.pitSurrogate.baseline_acc}</td>
                <td>{learned.pitSurrogate.nEval}</td></tr>
            </tbody>
          </table>
          <Callout variant="honest" title={es ? 'Lectura honesta' : 'Honest reading'}>
            {es
              ? `La evaluación deja fuera una geología completa (${learned.gradeNN.evalGroup}); pares de stencil completo/disperso nunca cruzan el split. La NN supera apenas IDW y queda bajo kriging ordinario. El pit-surrogate logra AUC ${learned.pitSurrogate.auc} en la geología excluida, una aproximación útil pero no la respuesta exacta. Sólo ordena reducciones fijar-dentro/fijar-fuera demostrablemente seguras; el min-cut certifica el óptimo.`
              : `Evaluation leaves out one complete geology (${learned.gradeNN.evalGroup}); paired full/sparse stencils never cross the split. The NN narrowly beats IDW and trails Ordinary Kriging. The pit surrogate reaches AUC ${learned.pitSurrogate.auc} on the excluded geology, useful but not exact. It only orders provably safe fix-in/fix-out reductions; the min-cut certifies the optimum.`}
          </Callout>
        </>
      ) : (
        <div className="pf-status" data-kind="error" role="alert">
          <strong>{es ? 'Evaluación aprendida no disponible' : 'Learned evaluation unavailable'}</strong>
          <p>{es ? 'No se pudo leer el artefacto validado; el solver exacto y los benchmarks clásicos siguen disponibles.' : 'The validated artifact could not be read; the exact solver and classical benchmarks remain available.'}</p>
          <div className="pf-status-actions"><button className="chip" onClick={loadLearnedData}>{es ? 'Reintentar' : 'Retry'}</button></div>
        </div>
      )}
    </article>
  );
}
