import { Callout, Tabs, useShellLang } from '@fasl-work/caos-app-shell';

export default function Implementation() {
  const es = useShellLang() === 'es';
  return (
    <article className="page-body prose">
      <h1>{es ? 'Implementación' : 'Implementation'}</h1>
      <p className="lede">{es
        ? 'PitForge está instanciado sobre el arquetipo de repo-producto CAOS (ADR-0057): dos contratos de datos, un pipeline por etapas, el gate de lane, y un frontend SPA que ejecuta el optimizador en vivo.'
        : 'PitForge is instantiated on the CAOS product-repo archetype (ADR-0057): two data contracts, a staged pipeline, the lane gate, and a frontend SPA that runs the optimiser live.'}</p>

      <Tabs ariaLabel={es ? 'implementación' : 'implementation'} tabs={[
        {
          id: 'lanes', label: es ? 'Lanes' : 'Lanes',
          content: (
            <div className="pf-doc-sec">
              <ul className="pf-list">
                <li><b>{es ? 'Live (cliente)' : 'Live (client)'}</b>, {es ? 'el solver de pit último + shells de Whittle en TypeScript (frontend/src/opt/) recalcula el pit en vivo al mover RF / precio / talud; los 2 modelos ONNX vía onnxruntime-web.' : 'the ultimate-pit + Whittle-shells TypeScript solver (frontend/src/opt/) re-solves the pit live as RF / price / slope move; the 2 ONNX models via onnxruntime-web.'}</li>
                <li><b>{es ? 'Offline (precompute)' : 'Offline (precompute)'}</b>, {es ? 'un precálculo Node ejecuta el mismo motor TS sobre los casos y produce data/derived/case-results.json; torch entrena los modelos aprendidos y los exporta a ONNX.' : 'a Node bake runs the same TS engine over the cases into data/derived/case-results.json; torch trains the learned models and exports them to ONNX.'}</li>
                <li><b>{es ? 'Replay (liviano)' : 'Replay (light)'}</b>, {es ? 'el pipeline Python numpy-only reformatea el precálculo en trazas + manifiestos por caso (Contrato 2). Sin torch ni Node, para CI/verificación rápida.' : 'the numpy-only Python pipeline reshapes the bake into per-case traces + manifests (Contract 2). No torch/Node, for fast CI/verify.'}</li>
              </ul>
              <Callout variant="note" title={es ? 'El gate decide el lane' : 'The gate decides the lane'}>
                {es ? 'Un caso se ejecuta en la lane live si es client-side, sus runtimes ⊆ {ts-pseudoflow, onnxruntime-web} y el solve + la traza caben en presupuesto. A escala didáctica (~7 000 bloques) todo se ejecuta en vivo.' : 'A case runs in the live lane if it is client-side, its runtimes ⊆ {ts-pseudoflow, onnxruntime-web} and the solve + trace fit budget. At teaching scale (~7 000 blocks) everything runs live.'}
              </Callout>
            </div>
          ),
        },
        {
          id: 'contracts', label: es ? 'Dos contratos' : 'Two contracts',
          content: (
            <div className="pf-doc-sec">
              <p><b>{es ? 'Contrato 1 (ingesta)' : 'Contract 1 (ingestion)'}</b>, {es ? 'io/contract.py valida escenarios (arquetipo/grilla/economía/talud) y una tabla real de bloques {ix,iy,iz,tonnage,density,grade}: rechaza tonelaje/densidad negativos, índices fuera de la caja y leyes no físicas; marca leyes implausibles y duplicados. Es la puerta para abrir un modelo de bloques propio.' : 'io/contract.py validates scenarios (archetype/grid/economics/slope) and a real block table {ix,iy,iz,tonnage,density,grade}: rejects negative tonnage/density, out-of-box indices and unphysical grades; flags implausible grades and duplicates. It is the gate to open a user-supplied block model.'}</p>
              <p><b>{es ? 'Contrato 2 (artefacto)' : 'Contract 2 (artifact)'}</b>, {es ? 'core/{trace,manifest}.py (pitforge.trace/v1 + manifest/v2). El frontend tiene un espejo TS (lib/contract.types.ts), una deriva rompe el build con tsc.' : 'core/{trace,manifest}.py (pitforge.trace/v1 + manifest/v2). The frontend has a TS mirror (lib/contract.types.ts), a drift breaks the build via tsc.'}</p>
            </div>
          ),
        },
        {
          id: 'learned', label: es ? 'Modelos aprendidos' : 'Learned models',
          content: (
            <Callout variant="honest" title={es ? 'Dos modelos honestos, no AE/CNN postizos' : 'Two honest models, not bolted-on AE/CNN'}>
              {es
                ? '(1) grade-NN: un estimador de ley por red neuronal vs kriging ordinario / IDW (R² held-out). (2) pit-surrogate: un clasificador de inclusión en el pit entrenado con las etiquetas exactas del solver, comparado contra el solver exacto como verdad de terreno (AUC). Ambos entrenan offline (torch, exportado a ONNX) y se ejecutan en vivo (onnxruntime-web). El optimizador exacto es el titular; estos son aproximaciones rápidas medidas contra su baseline. En este build ambos van entrenados (los .onnx están versionados; métricas held-out en Benchmark); si un modelo no carga, la app lo degrada y lo declara en el tab.'
                : '(1) grade-NN: a neural-network grade estimator vs Ordinary Kriging / IDW (held-out R²). (2) pit-surrogate: a pit-inclusion classifier trained on the exact solver labels, benchmarked against the exact solver as ground truth (AUC). Both train offline (torch, exported to ONNX) and run live (onnxruntime-web). The exact optimiser is the headline; these are fast approximations measured against their baseline. In this build both ship trained (the .onnx files are committed; held-out metrics in Benchmark); if a model fails to load, the app degrades gracefully and says so in the tab.'}
            </Callout>
          ),
        },
        {
          id: 'verify', label: es ? 'Verificado en ejecución' : 'Verified running',
          content: (
            <div className="pf-doc-sec">
              <pre className="codeblock">{`# light .venv-pipeline (numpy only)
ruff check data-pipeline tests          # clean
pytest                                  # 9 passed
python -m pflab.pipeline all            # 9 cases → traces + manifests
python scripts/check_artifacts.py       # Contract 2 OK
# byte-identical re-run → deterministic
cd frontend && npm test                 # 34 passed (engine · contracts · MineLib · infill)
npm run build                           # tsc + vite green`}</pre>
            </div>
          ),
        },
      ]} />
    </article>
  );
}
