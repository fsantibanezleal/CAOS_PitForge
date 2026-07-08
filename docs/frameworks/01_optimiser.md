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
PitForge solves the max-flow with **Dinic’s algorithm**, exact, deterministic. This is the same cut that Lerchs &
Grossmann’s 1965 graph algorithm and Hochbaum’s 2008 pseudoflow compute; we keep it transparent and self-checking
(the value identity is asserted every solve).

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
offline Python control (Dinic in `data-pipeline/pflab/science/cpit.py`).

### The nested-shell sweep is free (why we claim no learned speedup)

A tempting but wrong claim would be that a learned model speeds up the revenue-factor sweep. It does not need
speeding up: **parametric maximum flow** computes the entire sweep, all revenue-factor breakpoints, in the same
asymptotic time as a **single** max-flow (Gallo, Grigoriadis & Tarjan 1989; parametric pseudoflow, Hochbaum
2008). So the static UPL and its shell sweep are, at MineLib scale, a solved and fast problem. This is why the
honest depth contribution is the scheduling dimension (see `04_scheduling.md`) and a scale-oriented, exactness
-preserving learned preprocessing, never a shell-sweep speedup.

## Slope precedence

A wall at angle θ moves `Δz/tanθ` horizontally per bench up; in blocks, `r = round(Δz/(Δx·tanθ))`. We add arcs only to
the (2r+1)² template at the immediately-overlying bench and let **transitivity** rebuild the full cone, the standard
reduced precedence (efficient; keeps the live solve fast).

## Nested pit shells (Whittle)

Solving the UPL for an ascending RF schedule yields **nested** pits (each contains the previous) → the value /
tonnage / strip-ratio curves, a guide for the pushback order. Nesting is guaranteed analytically (lowering RF only lowers
values); we additionally union each shell with the previous to absorb any float-tie flicker.

## From the ultimate pit to a schedule

The ultimate pit is the undiscounted, uncapacitated limit of a production schedule. The scheduling extension
(time, per-period capacity, discounting, a certified NPV bound) is documented in `04_scheduling.md`.

**References:** Lerchs & Grossmann 1965 · Picard 1976 · Dinic 1970 · Hochbaum 2008 · Gallo, Grigoriadis &
Tarjan 1989 · Deutsch et al. 2022 (MineFlow) · Whittle 1988 · Hustrulid et al. 2013 (full citations in
`frontend/src/data/citations.ts`).
