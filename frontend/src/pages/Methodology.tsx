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
              <Callout variant="note" title={es ? 'El barrido de shells es gratis' : 'The shell sweep is free'}>
                {es ? 'El barrido de RF completo (todos los quiebres) se obtiene en el mismo tiempo asintótico que un solo max-flow por el flujo máximo paramétrico (Gallo, Grigoriadis y Tarjan ' : 'The entire RF sweep (all breakpoints) is obtained in the same asymptotic time as a single max-flow, via parametric maximum flow (Gallo, Grigoriadis & Tarjan '}<Cite id="gallo1989" paren />{es ? '; pseudoflow paramétrico, Hochbaum ' : '; parametric pseudoflow, Hochbaum '}<Cite id="hochbaum2008" paren />{es ? '). Por eso NO afirmamos un "speedup aprendido" del barrido: ya es gratis.' : '). This is why we do NOT claim a "learned speedup" of the sweep: it is already free.'}
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
              <Equation tex="x_{b,t-1}\le x_{b,t},\quad x_{b,t}\le x_{a,t}\ \forall a\in \mathrm{pred}(b),\quad \sum_b w_b\,(x_{b,t}-x_{b,t-1})\le C_t" caption={es ? 'monotonía · precedencia en cada periodo · capacidad de tonelaje por periodo' : 'monotonicity · precedence in every period · per-period tonnage capacity'} />
              <p>{es
                ? 'PitForge resuelve OFFLINE la relajación LP de este problema (Bienstock y Zuckerberg '
                : 'PitForge solves the LP relaxation of this problem OFFLINE (Bienstock & Zuckerberg '}<Cite id="bienstock2010" paren />{es
                ? '; estudio y aplicaciones, Munoz et al. '
                : '; study and applications, Munoz et al. '}<Cite id="munoz2018" paren />{es
                ? '): como es una maximización, la relajación es una COTA SUPERIOR certificada del NPV entero. Redondeamos un plan de pushbacks factible (heurística voraz que respeta precedencia y capacidad) y reportamos la BRECHA DE INTEGRALIDAD explícitamente. Una relajación LP es una cota, no un plan.'
                : '): because it is a maximisation, the relaxation is a CERTIFIED UPPER BOUND on the integer NPV. We round a feasible pushback schedule (a greedy heuristic respecting precedence and capacity) and report the INTEGRALITY GAP explicitly. An LP relaxation is a bound, not a schedule.'}</p>
              <Callout variant="strong" title={es ? 'Dualidad con el pit último' : 'Duality to the ultimate pit'}>
                {es
                  ? 'A tasa de descuento 0 y capacidad infinita el conjunto minado del CPIT es EXACTAMENTE el pit último (el pit último es el caso degenerado, no descontado y sin capacidad). Es el control de dualidad obligatorio: si no coincide bloque por bloque, es un bug, no un resultado. En newman1 y en el gemelo la cota LP reproduce el óptimo UPL exacto (26.086.899 y 126.908.454).'
                  : 'At discount rate 0 and infinite capacity the CPIT mined set is EXACTLY the ultimate pit (the ultimate pit is the degenerate, undiscounted, uncapacitated case). This is the mandatory duality control: if it does not match block-for-block, it is a bug, not a result. On newman1 and the twin the LP bound reproduces the exact UPL optimum (26,086,899 and 126,908,454).'}
              </Callout>
              <Callout variant="honest" title={es ? 'Alcance honesto' : 'Honest scope'}>
                {es
                  ? 'CPIT es SOTA de 2012, no un algoritmo nuevo: la contribución aquí es la ENTREGA transparente en el navegador (cota certificada + brecha + animación de bancos), atada al mismo terreno MineLib. PitForge entrega una REBANADA didáctica (cota + un plan de pushbacks en una o dos instancias); el planificador de producción completo es el producto hermano PhaseFlow.'
                  : 'CPIT is 2012 SOTA, not a new algorithm: the contribution here is the transparent in-browser DELIVERY (certified bound + gap + bench animation), tied to the same MineLib ground truth. PitForge ships a didactic SLICE (a bound + a pushback schedule on one or two instances); the full production scheduler is the sibling product PhaseFlow.'}
              </Callout>
            </div>
          ),
        },
        {
          id: 'reduction', label: es ? 'Reducción aprendida (exacta)' : 'Learned reduction (exact)',
          content: (
            <div className="pf-doc-sec">
              <p>{es
                ? 'El modelo ONNX de inclusión NO reemplaza al min-cut. Se reencuadra como preprocesamiento EXACTO acelerado por aprendizaje: los puntajes aprendidos sólo ORDENAN qué bloques probar contra reglas de fijación demostrablemente seguras. La seguridad viene de la regla, no de la red '
                : 'The ONNX inclusion model does NOT replace the min-cut. It is reframed as learning-accelerated EXACT preprocessing: the learned scores only ORDER which blocks to test against provably-safe fixing rules. Safety comes from the rule, not the net '}<Cite id="bengio2021" paren />{es ? ' ' : ' '}<Cite id="cappart2023" paren />{es ? '.' : '.'}</p>
              <Equation tex="\text{fix-OUT: } \hat v_b^{\,\text{best cone}}\le 0 \qquad \text{fix-IN: entire supporting cone } \ge 0" caption={es ? 'reglas de fijación que preservan el óptimo' : 'optimum-preserving fixing rules'} />
              <p>{es
                ? 'El min-cut exacto CERTIFICA la instancia reducida, así que el óptimo nunca cambia; el valor es ESCALA (permitir al navegador certificar una instancia mayor). El control de exactitud es obligatorio: el pit certificado sobre la instancia reducida DEBE igualar al pit del solve exacto completo, bloque por bloque; cualquier discrepancia rechaza la reducción. Enfoque relacionado en la práctica: pseudoflow y MineFlow open-source (Deutsch et al. '
                : 'The exact min-cut CERTIFIES the reduced instance, so the optimum never changes; the value is SCALE (letting the browser certify a bigger instance). The exactness control is mandatory: the pit certified on the reduced instance MUST equal the full exact-solve pit block-for-block; any mismatch rejects the reduction. Related in practice: pseudoflow and the open-source MineFlow (Deutsch et al. '}<Cite id="deutsch2022" paren />{es ? ').' : ').'}</p>
            </div>
          ),
        },
      ]} />

      <ReferenceList heading={es ? 'Referencias' : 'References'} />
    </article>
  );
}
