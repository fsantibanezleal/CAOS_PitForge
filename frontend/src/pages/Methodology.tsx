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
                {es ? 'Dinic es el rung exacto interactivo ' : 'Dinic is the exact interactive rung '}<Cite id="dinic1970" paren />{es ? '. Un segundo rung independiente implementa la fase uno de pseudoflow de árbol normalizado ' : '. A second independent rung implements normalised-tree pseudoflow phase one '}<Cite id="hochbaum2008" paren />{es ? '. Ambos reproducen los seis oráculos MineLib/gemelos validados; los tiempos comparativos se publican sin afirmar la complejidad de las variantes etiquetadas ni cortes idénticos bajo empates.' : '. Both reproduce the six validated MineLib/twin oracles; comparative timings are published without claiming labelled-variant complexity or identical cuts under ties.'}
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
              <p>{es ? 'Resolviendo el pit último para una secuencia creciente de RF se obtiene una familia de pits anidados (Whittle ' : 'Solving the ultimate pit for an increasing sequence of RF yields a family of nested pits (Whittle '}<Cite id="whittle1988" paren />{es ? '): cada pit contiene al anterior. Dan las curvas valor / tonelaje / razón de descapote vs RF y guían el orden de fases (pushbacks).' : '): each pit contains the previous. They give the value / tonnage / strip-ratio vs RF curves and guide the phase (pushback) order.'}</p>
              <p>{es ? 'El anidamiento se garantiza analíticamente (bajar RF sólo baja valores) y además unimos cada shell con el anterior para absorber cualquier empate numérico.' : 'Nesting is guaranteed analytically (lowering RF only lowers values) and we additionally union each shell with the previous to absorb any float tie.'}</p>
              <Callout variant="note" title={es ? 'Barrido exacto, reproducción liviana' : 'Exact sweep, lightweight playback'}>
                {es ? 'PitForge resuelve 12 factores de ingreso discretos con min-cuts exactos y conserva la familia completa antes de reproducirla. El timer sólo cambia un índice y se detiene al ocultar la pestaña. El flujo máximo paramétrico puede obtener todos los quiebres más eficientemente (Gallo, Grigoriadis y Tarjan ' : 'PitForge solves 12 discrete revenue factors with exact min-cuts and holds the complete family before playback. The timer changes only an index and stops when the tab is hidden. Parametric maximum flow can obtain all breakpoints more efficiently (Gallo, Grigoriadis & Tarjan '}<Cite id="gallo1989" paren />{es ? '; Hochbaum ' : '; Hochbaum '}<Cite id="hochbaum2008" paren />{es ? '), pero PitForge no implementa ni afirma ese algoritmo.' : '), but PitForge does not implement or claim that algorithm.'}
              </Callout>
            </div>
          ),
        },
        {
          id: 'schedule', label: es ? 'Frontera de scheduling' : 'Scheduling frontier',
          content: (
            <div className="pf-doc-sec">
              <p>{es
                ? 'El pit último es estático: no tiene tiempo, capacidad ni descuento. La frontera abierta (SOTA) es el scheduling de producción con restricciones de precedencia (CPIT): decidir en qué periodo se extrae cada bloque para maximizar el NPV descontado bajo capacidad por periodo. En forma acumulada por periodo (Chicoisne et al. '
                : 'The ultimate pit is static: no time, no capacity, no discounting. The open frontier (SOTA) is precedence-constrained production scheduling (CPIT): choosing which period each block is extracted in to maximise discounted NPV under a per-period capacity. In by-period cumulative form (Chicoisne et al. '}<Cite id="chicoisne2012" paren />{es ? '):' : '):'}</p>
              <Equation tex="\max \sum_{b,t} \frac{v_b}{(1+r)^{t-1}}\,(x_{b,t}-x_{b,t-1})" caption={es ? 'x_{b,t} in {0,1}: bloque b extraído hasta el periodo t (acumulado, monótono); r tasa de descuento' : 'x_{b,t} in {0,1}: block b extracted by period t (cumulative, monotone); r discount rate'} />
              <Equation tex="x_{b,t-1}\le x_{b,t},\quad x_{b,t}\le x_{a,t}\ \forall a\in \mathrm{pred}(b),\quad \sum_b w_{q,b}\,(x_{b,t}-x_{b,t-1})\le C_{q,t}\ \forall q" caption={es ? 'monotonía · precedencia · todas las capacidades de recursos por periodo' : 'monotonicity · precedence · every per-period resource capacity'} />
              <p>{es
                ? 'PitForge resuelve offline la relajación LP acumulada de Chicoisne et al. con scipy.optimize.linprog/HiGHS '
                : 'PitForge solves the cumulative Chicoisne et al. LP relaxation offline with scipy.optimize.linprog/HiGHS '}<Cite id="virtanen2020" paren />{es
                ? '. Bienstock y Zuckerberg '
                : '. Bienstock and Zuckerberg '}<Cite id="bienstock2010" paren />{es
                ? ' y Munoz et al. '
                : ' and Munoz et al. '}<Cite id="munoz2018" paren />{es
                ? ' dan algoritmos especializados y contexto de escala; PitForge no afirma ejecutar el algoritmo BZ. Como es una maximización, la relajación es una cota superior certificada. La heurística voraz respeta precedencia y todas las capacidades; una relajación LP es una cota, no un plan.'
                : 'provide specialized algorithms and scaling context; PitForge does not claim to run the BZ algorithm. Because this is a maximization, the relaxation is a certified upper bound. The greedy heuristic respects precedence and every capacity; an LP relaxation is a bound, not a schedule.'}</p>
              <Callout variant="strong" title={es ? 'Dualidad con el pit último' : 'Duality to the ultimate pit'}>
                {es
                  ? 'A tasa de descuento 0 y capacidad infinita el conjunto minado del CPIT es exactamente el pit último (el pit último es el caso degenerado, no descontado y sin capacidad). Es el control de dualidad obligatorio: si no coincide bloque por bloque, es un bug, no un resultado. En newman1 y en el gemelo la cota LP reproduce el óptimo UPL exacto (26.086.899 y 126.908.454).'
                  : 'At discount rate 0 and infinite capacity the CPIT mined set is exactly the ultimate pit (the ultimate pit is the degenerate, undiscounted, uncapacitated case). This is the mandatory duality control: if it does not match block-for-block, it is a bug, not a result. On newman1 and the twin the LP bound reproduces the exact UPL optimum (26,086,899 and 126,908,454).'}
              </Callout>
              <Callout variant="honest" title={es ? 'Alcance honesto' : 'Honest scope'}>
                {es
                  ? 'CPIT es SOTA de 2012, no un algoritmo nuevo. PitForge abre y resuelve el newman1.cpit publicado (6 periodos, 8%, dos recursos): reproduce la cota MineLib 24.486.184 con error relativo menor que 4e-9 y obtiene una heurística factible de 23.553.245, brecha 3,81% contra esa cota. El valor factible histórico citado es 23.483.671 / brecha 4,1%; no se afirma un nuevo mejor conocido. El gemelo usa un escenario PitForge separado (8 periodos, 10%, un recurso), rotulado no comparable.'
                  : 'CPIT is 2012 SOTA, not a new algorithm. PitForge opens and solves the published newman1.cpit (6 periods, 8%, two resources): it reproduces MineLib’s 24,486,184 bound within 4e-9 relative error and obtains a feasible 23,553,245 heuristic, a 3.81% gap to that bound. The cited historical feasible value is 23,483,671 / 4.1% gap; no new best-known result is claimed. The twin uses a separate PitForge scenario (8 periods, 10%, one resource), explicitly labeled non-comparable.'}
              </Callout>
            </div>
          ),
        },
        {
          id: 'reduction', label: es ? 'Reducción aprendida (exacta)' : 'Learned reduction (exact)',
          content: (
            <div className="pf-doc-sec">
              <p>{es
                ? 'El modelo ONNX de inclusión no reemplaza al min-cut, y tampoco lo acelera: produce una vista previa aproximada e instantánea de qué bloques caen dentro del pit, evaluada contra el solver exacto y reportada como porcentaje de acuerdo. El min-cut exacto corre de forma independiente y es siempre la autoridad '
                : 'The ONNX inclusion model does not replace the min-cut, and it does not accelerate it either: it produces an instant approximate preview of which blocks fall inside the pit, scored against the exact solver and reported as an agreement percentage. The exact min-cut runs independently and is always the authority '}<Cite id="bengio2021" paren />{es ? ' ' : ' '}<Cite id="cappart2023" paren />{es ? '.' : '.'}</p>
              <Equation tex="\text{fix-OUT: } \hat v_b^{\,\text{best cone}}\le 0 \qquad \text{fix-IN: entire supporting cone } \ge 0" caption={es ? 'reglas de fijación que preservan el óptimo' : 'optimum-preserving fixing rules'} />
              <p>{es
                ? 'El min-cut exacto certifica la instancia reducida, así que el óptimo nunca cambia; el valor es de escala (permitir al navegador certificar una instancia mayor). El control de exactitud es obligatorio: el pit certificado sobre la instancia reducida debe igualar al pit del solve exacto completo, bloque por bloque; cualquier discrepancia rechaza la reducción. Enfoque relacionado en la práctica: pseudoflow y MineFlow open-source (Deutsch et al. '
                : 'The exact min-cut certifies the reduced instance, so the optimum never changes; the value is scale (letting the browser certify a bigger instance). The exactness control is mandatory: the pit certified on the reduced instance must equal the full exact-solve pit block-for-block; any mismatch rejects the reduction. Related in practice: pseudoflow and the open-source MineFlow (Deutsch et al. '}<Cite id="deutsch2022" paren />{es ? ').' : ').'}</p>
            </div>
          ),
        },
      ]} />

      <ReferenceList heading={es ? 'Referencias' : 'References'} />
    </article>
  );
}
