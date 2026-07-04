# The live lane (TypeScript)

Unlike the SIR template (whose live lane is Pyodide-Python), PitForge’s live lane is **TypeScript** — the exact
optimiser in [`frontend/src/opt/`](../../frontend/src/opt/). The same modules run in the browser and in the offline
Node bake (via `tsx`), so there is exactly **one** implementation of the science — no Python re-port, no drift.

## The modules

| Module | Role |
|---|---|
| `maxflow.ts` | Dinic maximum-flow / minimum-cut — the exact engine |
| `precedence.ts` | the slope-precedence cone template (reduced 1-bench arcs + transitivity) |
| `econ.ts` | the floating-cutoff block-value model (RF, ore/waste decision) |
| `ultimatepit.ts` | builds the min-cut graph, solves it, reads the pit off the source side; checks the value identity |
| `whittle.ts` | nested pit shells over an ascending RF schedule + the value/tonnage/strip curves |
| `blockmodel.ts` | the seeded synthetic deposit archetypes |
| `cases.ts` | the 9 canonical cases (shared by the App and the bake) |

## Why TypeScript and not Pyodide

The ultimate-pit solve is a tight graph algorithm; a hand-written TS max-flow is fast (a teaching-scale solve is tens
of ms) and ships as a tiny bundle, whereas Pyodide would download a multi-MB runtime to do the same. The learned
models run via **onnxruntime-web** (WASM EP, single-threaded — GitHub Pages has no COOP/COEP for threads). The WASM
binary is pinned to the same version as the npm package (a skew is the classic load-failure trap).

## Live re-solve in the App

The App holds `(case, RF, price×, slope°)` in state. On every change it re-runs `solveUltimatePit(model, econ)` (one
fast max-flow) to drive the 3-D pit / section / KPIs, and recomputes `nestedPitShells` (the Whittle curve + shells)
when the case/price/slope change. The `pit-surrogate` ONNX runs live over the current section in the
**Surrogate · preview** tab (the grade-NN in **Infill · what-if**). This is the "interactive value-readout viz that
reacts to the controls" — the exact pit, re-solved, not a replay.
