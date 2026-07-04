# Framework — the optimiser

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
PitForge solves the max-flow with **Dinic’s algorithm** — exact, deterministic. This is the same cut that Lerchs &
Grossmann’s 1965 graph algorithm and Hochbaum’s 2008 pseudoflow compute; we keep it transparent and self-checking
(the value identity is asserted every solve).

## Slope precedence

A wall at angle θ moves `Δz/tanθ` horizontally per bench up; in blocks, `r = round(Δz/(Δx·tanθ))`. We add arcs only to
the (2r+1)² template at the immediately-overlying bench and let **transitivity** rebuild the full cone — the standard
reduced precedence (efficient; keeps the live solve fast).

## Nested pit shells (Whittle)

Solving the UPL for an ascending RF schedule yields **nested** pits (each contains the previous) → the value /
tonnage / strip-ratio curves, a guide for the pushback order. Nesting is guaranteed analytically (lowering RF only lowers
values); we additionally union each shell with the previous to absorb any float-tie flicker.

**References:** Lerchs & Grossmann 1965 · Picard 1976 · Dinic 1970 · Hochbaum 2008 · Whittle 1988 · Hustrulid et al.
2013 (full citations in `frontend/src/data/citations.ts`).
