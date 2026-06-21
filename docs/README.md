# PitForge — documentation

The navigable wiki for PitForge: open-pit **ultimate-pit limit** + **nested pit shells** (Whittle), with the exact
optimiser running live in the browser. Instantiated on the CAOS product-repo archetype (ADR-0057).

- **[Architecture](architecture.md)** — the archetype, the lanes, the gate, the two data contracts, determinism,
  deploy.
- **[Frameworks](frameworks.md)** — the optimiser (min-cut/pseudoflow + Whittle), the viz stack (three.js + µPlot),
  the learned models (torch → ONNX).
- **[Cases](cases.md)** — the 9 cases by category + their validation anchors.
- **[Guides](guides.md)** — instantiate, run the precompute/retrain lane, bring your own block model.

## One-paragraph orientation

The science is the **TypeScript optimiser** in [`frontend/src/opt/`](../frontend/src/opt/): it builds the
block-precedence graph, solves the maximum-weight closure as a **minimum cut / maximum flow** (the exact
Lerchs–Grossmann ultimate pit), and parameterises it by revenue factor into **nested pit shells**. It runs *live in
the browser* (the App re-solves as you drag the sliders) **and** in the offline Node bake (no Python re-port). The
Python package [`pflab`](../data-pipeline/pflab/) is the two data contracts + the staged pipeline + the lane gate; its
default lane is numpy-light (it reshapes the committed bake into replay traces), and a `--retrain` lane re-bakes the
cases and trains the two learned models (torch → ONNX).
