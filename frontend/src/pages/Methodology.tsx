import { Callout, Cite, Equation, InlineMath, ReferenceList, Tabs, useShellLang } from '@fasl-work/caos-app-shell';

export default function Methodology() {
  const es = useShellLang() === 'es';
  return (
    <article className="page-body prose">
      <h1>{es ? 'Metodología' : 'Methodology'}</h1>
      <p className="lede">{es
        ? 'El pit último es el cierre de máximo peso del grafo de precedencia de bloques, y el cierre máximo se reduce a un corte mínimo / flujo máximo. PitForge implementa esa reducción exacta.'
        : 'The ultimate pit is the maximum-weight closure of the block-precedence graph, and maximum closure reduces to a minimum cut / maximum flow. PitForge implements that exact reduction.'}</p>

      <Tabs ariaLabel={es ? 'metodología' : 'methodology'} tabs={[
        {
          id: 'value', label: es ? 'Valor de bloque' : 'Block value',
          content: (
            <div className="pf-doc-sec">
              <p>{es ? 'Cada bloque paga el costo de mina; va a planta sólo si el ingreso recuperable supera el costo de proceso (ley de corte flotante):' : 'Each block pays the mining cost; it goes to the mill only if recoverable revenue beats processing (the floating cutoff):'}</p>
              <Equation tex="v_i = \max\!\big(\,\mathrm{RF}\cdot p\,t_i g_i r - c_p t_i,\ 0\big) - c_m t_i" caption={es ? 'p precio, r recuperación, g ley, t tonelaje, c_p costo proceso, c_m costo mina, RF factor de ingreso' : 'p price, r recovery, g grade, t tonnage, c_p processing cost, c_m mining cost, RF revenue factor'} />
              <p>{es ? 'El factor de ingreso ' : 'The revenue factor '}<InlineMath tex="\mathrm{RF}\in(0,1]" />{es ? ' escala sólo el ingreso; bajarlo encoge el pit (así se generan los pits anidados).' : ' scales revenue only; lowering it shrinks the pit (this is how nested pits are built).'}</p>
            </div>
          ),
        },
        {
          id: 'closure', label: es ? 'Cierre → corte mínimo' : 'Closure → min-cut',
          content: (
            <div className="pf-doc-sec">
              <p>{es ? 'El pit es un cierre: si un bloque está en el pit, todos sus predecesores de talud también. Maximizar ' : 'A pit is a closure: if a block is in the pit, all its slope-predecessors are too. Maximising '}<InlineMath tex="\sum_{i\in P} v_i" />{es ? ' sobre los cierres P equivale a un corte mínimo s–t (Picard ' : ' over closures P is a minimum s–t cut (Picard '}<Cite id="picard1976" paren />{es ? '):' : '):'}</p>
              <Equation tex="s \xrightarrow{v_i} i\ (v_i>0),\quad i \xrightarrow{-v_i} t\ (v_i<0),\quad i \xrightarrow{\infty} j\ \text{(precedencia)}" />
              <p>{es ? 'Los bloques del lado de la fuente del corte mínimo forman el pit óptimo, y ' : 'The blocks on the source side of the min cut form the optimal pit, and '}<InlineMath tex="\text{valor} = \sum_{v_i>0} v_i - \text{maxflow}" />{es ? '. PitForge verifica esta identidad en cada solve.' : '. PitForge checks this identity on every solve.'}</p>
              <Callout variant="note" title={es ? 'El motor de flujo' : 'The flow engine'}>
                {es ? 'Resolvemos el flujo máximo con el algoritmo de Dinic ' : 'We solve the max-flow with Dinic’s algorithm '}<Cite id="dinic1970" paren />{es ? ', exacto y determinista. Es el mismo corte que calcula el pseudoflow de Hochbaum ' : ', exact and deterministic. It is the same cut Hochbaum’s pseudoflow computes '}<Cite id="hochbaum2008" paren />{es ? '; lo mantenemos transparente y auto-verificable.' : '; we keep it transparent and self-checking.'}
              </Callout>
            </div>
          ),
        },
        {
          id: 'slope', label: es ? 'Precedencia de talud' : 'Slope precedence',
          content: (
            <div className="pf-doc-sec">
              <p>{es ? 'Una pared a ángulo θ desde la horizontal: por cada banco que se sube (Δz), la pared puede moverse Δz/tan θ en horizontal. En bloques: ' : 'A wall at angle θ from horizontal: per bench up (Δz), the wall may move Δz/tan θ horizontally. In blocks: '}<InlineMath tex="r = \mathrm{round}(\Delta z / (\Delta x\,\tan\theta))" />.</p>
              <p>{es ? 'Añadimos arcos sólo al banco inmediatamente superior (la plantilla (2r+1)²) y dejamos que la transitividad reconstruya el cono completo, la precedencia reducida estándar.' : 'We add arcs only to the immediately-overlying bench (the (2r+1)² template) and let transitivity rebuild the full cone, the standard reduced precedence.'}</p>
            </div>
          ),
        },
        {
          id: 'whittle', label: es ? 'Pits anidados (Whittle)' : 'Nested pits (Whittle)',
          content: (
            <div className="pf-doc-sec">
              <p>{es ? 'Resolviendo el pit último para una secuencia creciente de RF se obtiene una familia de pits ANIDADOS (Whittle ' : 'Solving the ultimate pit for an increasing sequence of RF yields a family of NESTED pits (Whittle '}<Cite id="whittle1988" paren />{es ? '): cada pit contiene al anterior. Dan las curvas valor / tonelaje / razón de descapote vs RF y guían el orden de fases (pushbacks).' : '): each pit contains the previous. They give the value / tonnage / strip-ratio vs RF curves and guide the phase (pushback) order.'}</p>
              <p>{es ? 'El anidamiento se garantiza analíticamente (bajar RF sólo baja valores) y además unimos cada shell con el anterior para absorber cualquier empate numérico.' : 'Nesting is guaranteed analytically (lowering RF only lowers values) and we additionally union each shell with the previous to absorb any float tie.'}</p>
            </div>
          ),
        },
      ]} />

      <ReferenceList heading={es ? 'Referencias' : 'References'} />
    </article>
  );
}
