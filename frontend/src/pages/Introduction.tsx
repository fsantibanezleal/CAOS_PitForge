import { Callout, Cite, Tabs, useShellLang } from '@fasl-work/caos-app-shell';

export default function Introduction() {
  const es = useShellLang() === 'es';
  return (
    <article className="page-body prose">
      <h1>{es ? 'Introducción' : 'Introduction'}</h1>
      <p className="lede">{es
        ? 'PitForge resuelve el problema clásico del diseño de rajo abierto: dado un modelo de bloques con valor económico por bloque, ¿qué bloques conviene extraer para maximizar el valor total respetando los ángulos de talud? La respuesta exacta es el pit último (ultimate pit limit), y su familia de pits anidados por factor de ingreso guía las fases (pushbacks).'
        : 'PitForge solves the classic open-pit design problem: given a block model with a per-block economic value, which blocks should be extracted to maximise total value subject to slope constraints? The exact answer is the ultimate pit limit, and its family of nested pits by revenue factor guides the phases (pushbacks).'}</p>

      <Callout variant="strong" title={es ? 'El optimizador exacto corre EN VIVO en tu browser' : 'The exact optimiser runs LIVE in your browser'}>
        {es
          ? 'El pit último se calcula con un solver de flujo máximo / corte mínimo (Lerchs–Grossmann por la reducción de cierre máximo de Picard) escrito en TypeScript — el mismo motor corre en el browser y en el horneado offline. Arrastra el factor de ingreso, el precio o el talud y el pit se recalcula exacto al instante.'
          : 'The ultimate pit is computed with a max-flow / min-cut solver (Lerchs–Grossmann via Picard’s max-closure reduction) written in TypeScript — the same engine runs in the browser and in the offline bake. Drag the revenue factor, price or slope and the pit re-solves exactly, instantly.'}
      </Callout>

      <Tabs ariaLabel={es ? 'introducción' : 'introduction'} tabs={[
        {
          id: 'what', label: es ? 'Qué es' : 'What it is',
          content: (
            <div className="pf-doc-sec">
              <p>{es
                ? 'Un modelo de bloques discretiza el yacimiento en una grilla regular; cada bloque lleva tonelaje, densidad y ley. Con precios, recuperación y costos se obtiene un valor económico por bloque. El pit último es el subconjunto de bloques de valor total máximo que respeta la precedencia de talud: para extraer un bloque, primero hay que sacar los bloques sobre él dentro del cono del ángulo de talud.'
                : 'A block model discretises the orebody into a regular grid; each block carries tonnage, density and grade. Prices, recovery and costs give a per-block economic value. The ultimate pit is the maximum-total-value subset of blocks that honours slope precedence: to extract a block you must first remove the blocks above it within the slope-angle cone.'}</p>
              <p>{es
                ? 'PitForge incluye cuatro arquetipos de yacimiento (pórfido cuprífero, veta tabular, estratoligado y núcleo de alta ley con halo), escenarios económicos (precio bajo/base/alto), de talud, y un control oráculo con respuesta cerrada.'
                : 'PitForge ships four deposit archetypes (porphyry copper, tabular vein, stratabound, high-grade core + halo), economic scenarios (low/base/high price), slope scenarios, and a closed-form oracle control.'}</p>
            </div>
          ),
        },
        {
          id: 'why', label: es ? 'Por qué importa' : 'Why it matters',
          content: (
            <div className="pf-doc-sec">
              <p>{es
                ? 'El pit último fija las reservas, la vida de la mina y el contorno final; los pits anidados de Whittle guían el secuenciamiento por fases. Es el primer eslabón cuantitativo entre la geología y el plan minero. Lerchs & Grossmann '
                : 'The ultimate pit fixes the reserves, the mine life and the final wall; the Whittle nested pits guide phase sequencing. It is the first quantitative link between geology and the mine plan. Lerchs & Grossmann '}
                <Cite id="lerchs1965" paren /> {es ? 'dieron el algoritmo de grafos en 1965; Picard ' : 'gave the graph algorithm in 1965; Picard '}<Cite id="picard1976" paren />{es ? ' mostró la equivalencia con el corte mínimo, y Hochbaum ' : ' showed the min-cut equivalence, and Hochbaum '}<Cite id="hochbaum2008" paren />{es ? ' dio el pseudoflow, el método exacto más rápido hoy.' : ' gave pseudoflow, the fastest exact method today.'}</p>
            </div>
          ),
        },
        {
          id: 'honesty', label: es ? 'Honestidad' : 'Honesty',
          content: (
            <Callout variant="honest" title={es ? 'Qué es real y qué es sintético' : 'What is real and what is synthetic'}>
              {es
                ? 'La lane sintética usa yacimientos GENERADOS (campos de ley con tendencia geológica + ruido espacialmente correlacionado, semilla fija) — ahí no hay sondajes reales. La lane real usa 3 instancias PUBLICADAS de MineLib (newman1, zuck_small, kd), descargadas en runtime (ningún byte de instancia va commiteado), y el solver reproduce su óptimo UPIT publicado. El OPTIMIZADOR es exacto: el corte mínimo es el mismo que calcula el pseudoflow. El control CTRL tiene respuesta cerrada verificable a mano. Los 2 modelos aprendidos (entrenados en depósitos sintéticos) se comparan SIEMPRE contra su baseline clásico (kriging/IDW; el solver exacto), nunca se presentan superándolo.'
                : 'The synthetic lane uses GENERATED deposits (grade fields with a geological trend + spatially-correlated noise, fixed seed) — no real drillholes there. The real lane uses 3 PUBLISHED MineLib instances (newman1, zuck_small, kd), fetched at runtime (no instance bytes are committed), and the solver reproduces their published UPIT optimum. The OPTIMISER is exact: the min-cut is the same one pseudoflow computes. The CTRL control has a hand-verifiable closed-form answer. The 2 learned models (trained on synthetic deposits) are ALWAYS compared against their classical baseline (kriging/IDW; the exact solver), never presented as beating it.'}
            </Callout>
          ),
        },
      ]} />
    </article>
  );
}
