# Framework, the optimiser

The headline science. PitForge computes the **exact** ultimate pit, the modern way.

## Block value (the floating cutoff)

Each block pays the mining cost; it is milled only if the recoverable revenue beats the processing cost:

```
revenue_i = price · tonnage_i · grade_i · recovery
v_i = max( RF · revenue_i − processingCost · tonnage_i , 0 ) − miningCost · tonnage_i
```

`RF ∈ (0,1]` is the Whittle **revenue factor**; it scales revenue only, and lowering it shrinks the pit.

## Ultimate pit = maximum closure = minimum cut

A pit is a **closure** of the block-precedence digraph (if a block is in, all its slope-predecessors are in).
Maximising `Σ_{i∈P} v_i` over closures `P` is a minimum *s–t* cut (Picard 1976):

```
s ──v_i──►  i      for every block with v_i > 0
i  ──−v_i─► t      for every block with v_i < 0
i  ──∞───►  j      for every precedence arc (j must be removed to mine i)
```

The blocks on the **source side of the min cut** are the optimal pit, and `pitValue = Σ_{v_i>0} v_i − maxflow`.
PitForge ships two independent exact rungs. **Dinic’s algorithm** is the deterministic live default. The second is
an independently implemented, closure-specialised normalised-tree **pseudoflow** phase one following Hochbaum
(2008), with merger, path inversion, excess push and saturated-arc split counters. The pseudoflow rung deliberately
uses a transparent full merger scan rather than claiming the paper's labelled complexity. Both reproduce all six
validated MineLib/twin optima and return the same block set on those cases; tied optima can differ in general, so
PitForge claims equal optimal value, not universal cut identity. The value identity is asserted on every solve.

### Why min-cut equals max-closure (the LP-duality derivation)

The maximum-weight closure is an integer program. Let `x_i in {0,1}` mark block i as mined, with the closure
(precedence) constraint that mining i forces mining each overlying j:

```
maximise    sum_i v_i x_i
subject to  x_i - x_j <= 0   for every precedence arc i -> j   (mine i only if j is mined)
            x_i in {0,1}
```

The constraint matrix of a closure problem is **totally unimodular** (it is the incidence structure of a
directed graph), so the LP relaxation `x_i in [0,1]` has an **integral optimum**: the relaxation is exact, no
branching needed. Take its LP dual. Split the objective as `sum_i v_i x_i = sum_{v_i>0} v_i - sum_{v_i>0} v_i(1-x_i) - sum_{v_i<0} (-v_i) x_i`,
a constant minus a non-negative penalty. Minimising that penalty subject to the precedence arcs having infinite
capacity is exactly a **minimum s-t cut**: put a source arc `s -> i` of capacity `v_i` for `v_i > 0`, a sink arc
`i -> t` of capacity `-v_i` for `v_i < 0`, and the precedence arcs `i -> j` at capacity infinity (so no optimal
cut ever severs a precedence arc, which enforces the closure). By LP strong duality (max-flow min-cut),

```
min cut  =  maxflow ,     and     pit value  =  sum_{v_i>0} v_i  -  maxflow .
```

The blocks reachable from `s` in the residual graph (the source side) are precisely the closure that attains the
maximum, i.e. the optimal pit. Complementary slackness is what guarantees the reachable set is a valid closure:
an unsaturated precedence arc cannot cross the cut, so no mined block is missing an overlying block. PitForge
asserts the value identity `pitValue = Σ positive − maxflow` on **every** solve, in both the browser and the
offline Python control (Dinic in `data-pipeline/pipeline/science/cpit.py`).

### The nested-shell sweep: exact, discrete, and precomputed before playback

PitForge currently solves the 12 declared revenue factors independently with exact Dinic min-cuts and stores the
whole family before playback. The UI timer only advances a shell index and pauses on a hidden tab; it never solves
inside `requestAnimationFrame` or the playback interval. Parametric maximum-flow methods can obtain all breakpoints
more efficiently (Gallo, Grigoriadis & Tarjan 1989; Hochbaum 2008), but that algorithm is not implemented here.
Accordingly PitForge makes no "free sweep" or parametric-runtime claim and no learned speedup claim.

## Slope precedence

A wall at angle θ moves `Δz/tanθ` horizontally per bench up; in blocks, `r = round(Δz/(Δx·tanθ))`. We add arcs only to
the (2r+1)² template at the immediately-overlying bench and let **transitivity** rebuild the full cone, the standard
reduced precedence (efficient; keeps the live solve fast).

## Nested pit shells (Whittle)

Solving the UPL for an ascending RF schedule yields **nested** pits (each contains the previous), giving the value /
tonnage / strip-ratio curves, a guide for the pushback order. Nesting is guaranteed analytically (lowering RF only lowers
values); we additionally union each shell with the previous to absorb any float-tie flicker.

## From the ultimate pit to a schedule

The ultimate pit is the undiscounted, uncapacitated limit of a production schedule. The scheduling extension
(time, per-period capacity, discounting, a certified NPV bound) is documented in `04_scheduling.md`.

**References:** Lerchs and Grossmann 1965; Picard 1976; Hochbaum and Chen 2000; Dinic 1970; Hochbaum 2008;
Gallo, Grigoriadis and Tarjan 1989; Deutsch et al. 2022 (MineFlow); Whittle 1988; Hustrulid et al. 2013. Full
citations are in `frontend/src/data/citations.ts`.
