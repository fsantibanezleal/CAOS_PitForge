// In-app Architecture / "How it works" modal config (ADR-0058) for PitForge.
// Passed to <AppShell config={{ ...config, architecture }}>. The ⓘ header button
// (provided by @fasl-work/caos-app-shell >= 0.1.2) opens the modal. Each tab pairs
// one hand-authored THEMED SVG (frontend/public/svg/tech/, shell CSS-var tokens →
// repaints with the active theme, fetched + inlined) with a bilingual ES/EN body.
import type { ArchitectureConfig } from '@fasl-work/caos-app-shell';

export const architecture: ArchitectureConfig = {
  tabs: [
    {
      id: 'app',
      en: 'The app',
      es: 'La app',
      svg: 'svg/tech/01-the-app.svg',
      body_en:
        'PitForge is an open-pit planning product: from a block model, the economics (price/cost/recovery) and a slope ' +
        'constraint, it computes the EXACT ultimate pit (Lerchs–Grossmann) and the Whittle nested shells — answering ' +
        '"what is the most valuable pit you can dig, respecting the wall angle?". You drag the price, cost or slope and ' +
        'the optimal pit + the value-vs-tonnage curve recompute live.\n\n' +
        'It is a real system, not a demo. The ultimate-pit optimiser (frontend/src/opt/) recomputes the exact pit as the ' +
        'minimum cut of a max-flow network built from the block values + the slope precedence arcs — exact, not a ' +
        'heuristic. A grade-NN estimates block grades and a pit-surrogate predicts pit membership — both ONNX, ' +
        'client-side. An inverted-pyramid oracle case has a hand-computable optimal pit (a closed-form correctness anchor).\n\n' +
        'Two sources, one engine. SYNTHETIC: seeded deposit archetypes (porphyry, vein, layered, core+halo — stated ' +
        'openly as synthetic) plus the CTRL oracle. REAL: published MineLib benchmark instances (Espinoza et al. 2013), ' +
        'fetched at runtime into browser memory — never redistributed with the app, because the MineLib license only ' +
        'grants download for academic purposes. In real mode the scenario knobs lock: the instance ships explicit ' +
        'precedence and net block values, and the solve must reproduce the published optimum.',
      body_es:
        'PitForge es un producto de planificación de rajo abierto: desde un modelo de bloques, la economía ' +
        '(precio/costo/recuperación) y una restricción de talud, computa el pit final EXACTO (Lerchs–Grossmann) y las ' +
        'cáscaras anidadas de Whittle — respondiendo "¿cuál es el pit más valioso que puedes excavar, respetando el ' +
        'ángulo de talud?". Arrastras el precio, el costo o el talud y el pit óptimo + la curva valor-vs-tonelaje ' +
        'recalculan en vivo.\n\n' +
        'Es un sistema real, no un demo. El optimizador de pit final (frontend/src/opt/) recalcula el pit exacto como el ' +
        'corte mínimo de una red de flujo máximo construida desde los valores de bloque + los arcos de precedencia de ' +
        'talud — exacto, no una heurística. Una grade-NN estima las leyes de bloque y un pit-surrogate predice la ' +
        'pertenencia al pit — ambos ONNX, en el cliente. Un caso oráculo de pirámide invertida tiene un pit óptimo ' +
        'calculable a mano (un ancla de corrección de forma cerrada).\n\n' +
        'Dos fuentes, un motor. SINTÉTICO: arquetipos de depósito con semilla (pórfido, veta, estratificado, ' +
        'núcleo+halo — declarados abiertamente como sintéticos) más el oráculo CTRL. REAL: instancias del benchmark ' +
        'MineLib (Espinoza et al. 2013), descargadas en runtime a memoria del navegador — nunca redistribuidas con la ' +
        'app, porque la licencia MineLib sólo permite descarga con fines académicos. En modo real las perillas de ' +
        'escenario se bloquean: la instancia trae precedencia explícita y valores netos, y el solve debe reproducir el ' +
        'óptimo publicado.',
    },
    {
      id: 'lanes',
      en: 'Lanes — web / offline / compute',
      es: 'Carriles — web / offline / cómputo',
      svg: 'svg/tech/02-lanes.svg',
      body_en:
        'Three lanes, and the split is the point. WEB (live, in the browser): the TypeScript ultimate-pit optimiser ' +
        '(frontend/src/opt/) re-runs on every control and onnxruntime-web runs grade-nn.onnx + pit-surrogate.onnx — no ' +
        'server. OFFLINE / COMPUTE (your machine, isolated .venv): the Python pipeline bakes the canonical case ' +
        'artifacts (the pits + shells per scenario) and the heavy lane (--retrain, .venv-precompute, torch) trains the ' +
        'grade-NN + the pit-surrogate and exports them to ONNX. REPLAY: the small, committed artifacts in data/derived ' +
        'are overlaid into the SPA by copy-data.mjs and loaded live; the typed mirror (contract.types.ts) fails the ' +
        'build if the web and the pipeline shapes ever diverge.',
      body_es:
        'Tres carriles, y la división es lo central. WEB (en vivo, en el navegador): el optimizador de pit final en ' +
        'TypeScript (frontend/src/opt/) re-corre con cada control y onnxruntime-web ejecuta grade-nn.onnx + ' +
        'pit-surrogate.onnx — sin servidor. OFFLINE / CÓMPUTO (tu máquina, .venv aislado): el pipeline Python hornea los ' +
        'artefactos canónicos por caso (los pits + cáscaras por escenario) y el carril pesado (--retrain, ' +
        '.venv-precompute, torch) entrena la grade-NN + el pit-surrogate y los exporta a ONNX. REPLAY: los artefactos ' +
        'pequeños y versionados en data/derived se superponen al SPA con copy-data.mjs y se cargan en vivo; el espejo ' +
        'tipado (contract.types.ts) rompe el build si la web y el pipeline divergen.',
    },
    {
      id: 'web-flow',
      en: 'Web-app flow',
      es: 'Flujo de la web',
      svg: 'svg/tech/03-web-flow.svg',
      body_en:
        'The App page recomputes live: inputs (the case selector or your own block model, plus the price, cost and ' +
        'slope controls) feed the TypeScript ultimate-pit optimiser and the onnxruntime-web inference, which feed the ' +
        'interactive viz — the 3-D pit, the block-model section, the Whittle value-vs-tonnage curves and the ' +
        'surrogate-vs-exact agreement, each reading values back on hover/click. The six sibling pages (App · ' +
        'Introduction · Methodology · Implementation · Experiments · Benchmark) are identical across every CAOS ' +
        'product. The build is gated by the contract-type mirror, the artifacts are overlaid by copy-data, vite builds ' +
        'the static output, and GitHub Pages serves it at pitforge.fasl-work.com.',
      body_es:
        'La página App recalcula en vivo: las entradas (el selector de casos o tu propio modelo de bloques, más los ' +
        'controles de precio, costo y talud) alimentan el optimizador de pit final en TypeScript y la inferencia ' +
        'onnxruntime-web, que alimentan la visualización interactiva — el pit 3-D, la sección del modelo de bloques, las ' +
        'curvas valor-vs-tonelaje de Whittle y el acuerdo surrogate-vs-exacto, cada uno devolviendo valores al ' +
        'pasar/hacer clic. Las seis páginas hermanas (App · Introducción · Metodología · Implementación · Experimentos · ' +
        'Benchmark) son idénticas en todos los productos CAOS. El build lo controla el espejo de tipos del contrato, los ' +
        'artefactos los superpone copy-data, vite construye el estático y GitHub Pages lo sirve en pitforge.fasl-work.com.',
    },
    {
      id: 'science',
      en: 'The science',
      es: 'La ciencia',
      svg: 'svg/tech/04-the-science.svg',
      body_en:
        'The optimiser, step by step: ① each block gets an economic value v_i = (grade·rec·price − mill cost)·t − mine ' +
        'cost·t (ore iff v_i > 0 — the cut-off grade); ② a slope template adds precedence arcs (a block needs the cone ' +
        'above it removed first); ③ the maximum-value closed set under those arcs is, by Lerchs–Grossmann duality, the ' +
        'minimum cut of an s-t max-flow network — solved EXACTLY (no heuristic); ④ sweeping the revenue factor λ traces ' +
        'the Whittle nested shells (pit(λ₁) ⊆ pit(λ₂)) — the value-vs-tonnage curve. Outputs: the pit, tonnes, grade, NPV.\n\n' +
        'The exact min-cut optimiser is always on and transparent — the optimal pit, the reference every learned ' +
        'prediction is measured against. The learned lane: a grade-NN (a 27-vec IDW stencil → block grade, vs IDW/' +
        'kriging) and a pit-surrogate (4 block features → P(block ∈ pit)); both run client-side as ONNX, reported next ' +
        'to the exact pit (% agreement), never as a black box.',
      body_es:
        'El optimizador, paso a paso: ① cada bloque recibe un valor económico v_i = (ley·rec·precio − costo molienda)·t ' +
        '− costo mina·t (mineral si v_i > 0 — la ley de corte); ② una plantilla de talud agrega arcos de precedencia (un ' +
        'bloque necesita que se retire primero el cono sobre él); ③ el conjunto cerrado de valor máximo bajo esos arcos ' +
        'es, por la dualidad de Lerchs–Grossmann, el corte mínimo de una red de flujo máximo s-t — resuelto EXACTAMENTE ' +
        '(sin heurística); ④ barriendo el revenue factor λ se trazan las cáscaras anidadas de Whittle (pit(λ₁) ⊆ ' +
        'pit(λ₂)) — la curva valor-vs-tonelaje. Salidas: el pit, toneladas, ley, VAN.\n\n' +
        'El optimizador exacto de corte mínimo está siempre activo y es transparente — el pit óptimo, la referencia ' +
        'contra la que se mide toda predicción aprendida. El carril aprendido: una grade-NN (un stencil IDW de 27-vec → ' +
        'ley de bloque, vs IDW/kriging) y un pit-surrogate (4 features de bloque → P(bloque ∈ pit)); ambos corren en el ' +
        'cliente como ONNX, reportados junto al pit exacto (% de acuerdo), nunca como caja negra.',
    },
    {
      id: 'design',
      en: 'Data contracts / design',
      es: 'Contratos de datos / diseño',
      svg: 'svg/tech/05-data-contracts.svg',
      body_en:
        'Two validated data contracts bracket the pipeline. Contract 1 (ingestion) defines a valid block model — the ' +
        'grid dimensions, per-block grade + rock type, the economic parameters and the slope angle, with range/NaN ' +
        'guards — so the app accepts your data, not just the built-in cases. Contract 2 (artifact) defines the output ' +
        'the web reads (per-case pits + shells, the surrogate-vs-exact agreement, the model index), mirrored exactly by ' +
        'contract.types.ts. Between them the staged, deterministic pipeline runs the lane gate (numpy-light by default, ' +
        '--retrain for the heavy torch lane) and writes a provenance manifest, so every result is reproducible and the ' +
        'web can never silently drift.\n\n' +
        'Honesty, on the record: every baked case carries a provenance manifest (lane verdict, runtimes, artifact ' +
        'bytes and an explicit honesty statement — all deposits are synthetic and seeded; nothing is presented as ' +
        'field data). The manifests are versioned in data/derived and enforced by the CI drift gate; the App shows ' +
        'the domain views and keeps this meta-layer here and in Benchmark.',
      body_es:
        'Dos contratos de datos validados encierran el pipeline. El Contrato 1 (ingesta) define un modelo de bloques ' +
        'válido — las dimensiones de la grilla, ley + tipo de roca por bloque, los parámetros económicos y el ángulo de ' +
        'talud, con guardas de rango/NaN — para que la app acepte tus datos, no sólo los casos incluidos. El Contrato 2 ' +
        '(artefacto) define la salida que lee la web (pits + cáscaras por caso, el acuerdo surrogate-vs-exacto, el ' +
        'índice de modelos), espejada exactamente por contract.types.ts. Entre ambos, el pipeline por etapas y ' +
        'determinista corre el lane gate (numpy-light por defecto, --retrain para el carril pesado de torch) y escribe ' +
        'un manifest de procedencia, de modo que cada resultado es reproducible y la web nunca diverge en silencio.\n\n' +
        'Honestidad, en el registro: cada caso horneado lleva un manifest de procedencia (veredicto de carril, ' +
        'runtimes, bytes del artefacto y una declaración explícita de honestidad — todos los depósitos son sintéticos ' +
        'y con semilla; nada se presenta como datos de terreno). Los manifests están versionados en data/derived y los ' +
        'exige el gate de deriva en CI; la App muestra las vistas de dominio y esta meta-capa vive aquí y en Benchmark.',
    },
  ],
};
